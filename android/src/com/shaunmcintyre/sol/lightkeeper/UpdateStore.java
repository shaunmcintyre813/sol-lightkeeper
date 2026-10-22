package com.shaunmcintyre.sol.lightkeeper;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;

/** Stages a whole, hash-checked web release before changing the WebView's local assets. */
public final class UpdateStore {
    public interface Source {
        InputStream open(String path) throws IOException;
    }

    public static final class Launch {
        public final File directory; // null means the APK's signed, bundled assets
        public final String id;
        public final boolean pending;

        Launch(File directory, String id, boolean pending) {
            this.directory = directory;
            this.id = id;
            this.pending = pending;
        }
    }

    private static final int MAX_MANIFEST = 65536;
    private static final int MAX_FILE = 2 * 1024 * 1024;
    private static final int MAX_RELEASE = 10 * 1024 * 1024;
    private static final String[] REQUIRED = {"index.html", "style.css", "game.mjs", "core.mjs", "manifest.webmanifest"};
    private final File root;
    private final URL base;
    private final Source source;
    private final Manifest bundled;
    private final File stateFile;
    private final Properties state = new Properties();

    public UpdateStore(File root, URL base, Source source, InputStream bundledManifest) throws IOException {
        this.root = root;
        this.base = base;
        this.source = source;
        this.bundled = parse(readAll(bundledManifest, MAX_MANIFEST));
        this.stateFile = new File(root, "state.properties");
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Cannot create update directory");
        if (stateFile.isFile()) {
            try (InputStream in = new FileInputStream(stateFile)) { state.load(in); }
        }
    }

    public synchronized Launch prepare(boolean online) throws IOException {
        // A prior launch that never reached game initialization is not a working release.
        String interrupted = state.getProperty("pending", "");
        if (!interrupted.isEmpty()) {
            state.setProperty("rejected", interrupted);
            state.remove("pending");
            state.remove("pendingBuild");
            saveState();
        }
        Launch working = workingLaunch();
        if (!online) return working;
        try {
            byte[] manifestBytes = fetch("update.manifest", MAX_MANIFEST);
            Manifest offered = parse(manifestBytes);
            if (offered.build <= currentBuild() || offered.id.equals(state.getProperty("rejected"))) return working;
            File release = new File(new File(root, "versions"), offered.id);
            if (!offered.id.equals(readManifestId(release)) || !verify(release, offered)) {
                File staging = new File(root, "staging-" + offered.id);
                deleteTree(staging);
                if (!staging.mkdirs()) throw new IOException("Cannot stage update");
                try {
                    for (Entry entry : offered.entries) {
                        File target = new File(staging, entry.path);
                        File parent = target.getParentFile();
                        if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("Cannot stage " + entry.path);
                        byte[] content = fetch(entry.path, entry.size);
                        if (content.length != entry.size || !sha256(content).equals(entry.sha256)) throw new IOException("Hash mismatch: " + entry.path);
                        try (FileOutputStream out = new FileOutputStream(target)) { out.write(content); out.getFD().sync(); }
                    }
                    try (FileOutputStream out = new FileOutputStream(new File(staging, "update.manifest"))) {
                        out.write(manifestBytes); out.getFD().sync();
                    }
                    if (!verify(staging, offered)) throw new IOException("Incomplete update");
                    File versions = release.getParentFile();
                    if (!versions.isDirectory() && !versions.mkdirs()) throw new IOException("Cannot store update");
                    deleteTree(release); // Only a previously incomplete copy with this hash.
                    Files.move(staging.toPath(), release.toPath());
                } finally { deleteTree(staging); }
            }
            state.setProperty("pending", offered.id);
            state.setProperty("pendingBuild", Integer.toString(offered.build));
            saveState();
            return new Launch(release, offered.id, true);
        } catch (IOException | RuntimeException failure) {
            // Network, CDN propagation, and partial downloads never replace the working release.
            return working;
        }
    }

    public synchronized void ready(String id) throws IOException {
        if (!id.equals(state.getProperty("pending"))) return;
        String old = state.getProperty("current", "");
        int oldBuild = currentBuild();
        if (old.isEmpty()) {
            state.remove("previous");
            state.remove("previousBuild");
        } else {
            state.setProperty("previous", old);
            state.setProperty("previousBuild", Integer.toString(oldBuild));
        }
        state.setProperty("current", id);
        state.setProperty("currentBuild", state.getProperty("pendingBuild"));
        state.remove("pending");
        state.remove("pendingBuild");
        saveState();
    }

    public synchronized Launch failed(String id) throws IOException {
        state.setProperty("rejected", id);
        if (id.equals(state.getProperty("pending"))) {
            state.remove("pending");
            state.remove("pendingBuild");
        } else if (id.equals(state.getProperty("current"))) {
            String previous = state.getProperty("previous", "");
            if (previous.isEmpty()) {
                state.remove("current");
                state.remove("currentBuild");
            } else {
                state.setProperty("current", previous);
                state.setProperty("currentBuild", state.getProperty("previousBuild"));
            }
            state.remove("previous");
            state.remove("previousBuild");
        }
        saveState();
        return workingLaunch();
    }

    private Launch workingLaunch() throws IOException {
        String id = state.getProperty("current", "");
        if (!id.isEmpty()) {
            Launch valid = validatedLaunch(id);
            if (valid != null) return valid;
            state.setProperty("rejected", id);
            state.remove("current");
            state.remove("currentBuild");
            String previous = state.getProperty("previous", "");
            Launch fallback = previous.isEmpty() ? null : validatedLaunch(previous);
            if (fallback != null) {
                state.setProperty("current", previous);
                state.setProperty("currentBuild", state.getProperty("previousBuild"));
            }
            state.remove("previous");
            state.remove("previousBuild");
            saveState();
            if (fallback != null) return fallback;
        }
        return new Launch(null, bundled.id, false);
    }

    private Launch validatedLaunch(String id) {
        File directory = new File(new File(root, "versions"), id);
        if (!id.equals(readManifestId(directory))) return null;
        try (InputStream in = new FileInputStream(new File(directory, "update.manifest"))) {
            return verify(directory, parse(readAll(in, MAX_MANIFEST))) ? new Launch(directory, id, false) : null;
        } catch (IOException error) { return null; }
    }

    private int currentBuild() {
        try { return Integer.parseInt(state.getProperty("currentBuild", Integer.toString(bundled.build))); }
        catch (NumberFormatException e) { return bundled.build; }
    }

    private String readManifestId(File directory) {
        try (InputStream in = new FileInputStream(new File(directory, "update.manifest"))) { return sha256(readAll(in, MAX_MANIFEST)); }
        catch (IOException e) { return ""; }
    }

    private byte[] fetch(String path, int limit) throws IOException {
        if (source != null) return readAll(source.open(path), limit);
        URL url = new URL(base, path + "?sol_update=" + System.currentTimeMillis());
        if (!"https".equals(url.getProtocol()) || !base.getHost().equals(url.getHost())) throw new IOException("Untrusted update URL");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(4000);
        connection.setReadTimeout(8000);
        connection.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (connection.getResponseCode() != 200) throw new IOException("HTTP " + connection.getResponseCode());
            try (InputStream in = connection.getInputStream()) { return readAll(in, limit); }
        } finally { connection.disconnect(); }
    }

    private void saveState() throws IOException {
        File temporary = new File(root, "state.tmp");
        try (FileOutputStream out = new FileOutputStream(temporary)) { state.store(out, "Sol content state"); out.getFD().sync(); }
        Files.move(temporary.toPath(), stateFile.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    }

    private static boolean verify(File directory, Manifest manifest) {
        if (!directory.isDirectory()) return false;
        for (Entry entry : manifest.entries) {
            File file = new File(directory, entry.path);
            if (!file.isFile() || file.length() != entry.size) return false;
            try (InputStream in = new FileInputStream(file)) {
                if (!sha256(readAll(in, entry.size)).equals(entry.sha256)) return false;
            } catch (IOException e) { return false; }
        }
        return true;
    }

    private static Manifest parse(byte[] bytes) throws IOException {
        String[] lines = new String(bytes, StandardCharsets.UTF_8).trim().split("\\n");
        String[] header = lines[0].trim().split("\\t");
        if (header.length != 3 || !"sol-lightkeeper-content-v1".equals(header[0]) || !header[2].matches("[0-9]+\\.[0-9]+\\.[0-9]+")) throw new IOException("Invalid update manifest");
        int build;
        try { build = Integer.parseInt(header[1]); } catch (NumberFormatException e) { throw new IOException("Invalid content build", e); }
        if (build < 1 || lines.length < REQUIRED.length + 1 || lines.length > 100) throw new IOException("Invalid release size");
        List<Entry> entries = new ArrayList<>();
        Set<String> paths = new HashSet<>();
        int total = 0;
        for (int i = 1; i < lines.length; i++) {
            String[] fields = lines[i].trim().split("\\t");
            if (fields.length != 3) throw new IOException("Invalid manifest entry");
            String path = fields[0];
            if (!path.matches("[A-Za-z0-9._/-]+") || path.startsWith("/") || path.contains("..") || path.contains("//") || !paths.add(path)) throw new IOException("Unsafe update path");
            int size;
            try { size = Integer.parseInt(fields[1]); } catch (NumberFormatException e) { throw new IOException("Invalid file size", e); }
            if (size < 1 || size > MAX_FILE || !fields[2].matches("[0-9a-f]{64}")) throw new IOException("Invalid file metadata");
            total += size;
            if (total > MAX_RELEASE) throw new IOException("Release too large");
            entries.add(new Entry(path, size, fields[2]));
        }
        for (String required : REQUIRED) if (!paths.contains(required)) throw new IOException("Missing " + required);
        return new Manifest(build, sha256(bytes), entries);
    }

    private static byte[] readAll(InputStream in, int limit) throws IOException {
        try (InputStream source = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = source.read(buffer)) != -1) {
                if (out.size() + count > limit) throw new IOException("Update exceeds size limit");
                out.write(buffer, 0, count);
            }
            return out.toByteArray();
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) hex.append(String.format("%02x", value & 255));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    private static void deleteTree(File file) throws IOException {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children == null) throw new IOException("Cannot inspect staging directory");
            for (File child : children) deleteTree(child);
        }
        if (!file.delete()) throw new IOException("Cannot clean staging directory");
    }

    private static final class Entry {
        final String path;
        final int size;
        final String sha256;
        Entry(String path, int size, String sha256) { this.path = path; this.size = size; this.sha256 = sha256; }
    }

    private static final class Manifest {
        final int build;
        final String id;
        final List<Entry> entries;
        Manifest(int build, String id, List<Entry> entries) { this.build = build; this.id = id; this.entries = entries; }
    }
}
