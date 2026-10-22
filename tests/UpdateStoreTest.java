import com.shaunmcintyre.sol.lightkeeper.UpdateStore;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

public final class UpdateStoreTest {
    private static byte[] bytes(String text) { return text.getBytes(StandardCharsets.UTF_8); }
    private static String hash(byte[] bytes) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder result = new StringBuilder();
        for (byte value : digest) result.append(String.format("%02x", value & 255));
        return result.toString();
    }
    private static Map<String, byte[]> content(String suffix) {
        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("core.mjs", bytes("export const garden='" + suffix + "';"));
        files.put("game.mjs", bytes("import './core.mjs';"));
        files.put("index.html", bytes("<main>" + suffix + "</main>"));
        files.put("manifest.webmanifest", bytes("{\"name\":\"Sol\"}"));
        files.put("style.css", bytes("body{color:white}"));
        return files;
    }
    private static Map<String, byte[]> release(int build, String suffix) throws Exception {
        Map<String, byte[]> files = content(suffix);
        StringBuilder manifest = new StringBuilder("sol-lightkeeper-content-v1\t" + build + "\t1.0." + build + "\n");
        for (Map.Entry<String, byte[]> entry : files.entrySet()) {
            manifest.append(entry.getKey()).append('\t').append(entry.getValue().length).append('\t')
                .append(hash(entry.getValue())).append('\n');
        }
        files.put("update.manifest", bytes(manifest.toString()));
        return files;
    }
    private static UpdateStore store(Path root, Map<String, byte[]> bundle, Map<String, byte[]> offered) throws Exception {
        return new UpdateStore(root.toFile(), new URL("https://shaunmcintyre813.github.io/sol-lightkeeper/"), path -> {
            byte[] data = offered.get(path);
            if (data == null) throw new IOException("Partial CDN publish: " + path);
            return new ByteArrayInputStream(data);
        }, new ByteArrayInputStream(bundle.get("update.manifest")));
    }
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        Path testRoot = Path.of("android", "build");
        Files.createDirectories(testRoot);
        Path root = Files.createTempDirectory(testRoot, "sol-update-test-");
        Map<String, byte[]> bundle = release(3, "bundled");
        Map<String, byte[]> newer = release(4, "hosted-new-garden");
        UpdateStore updates = store(root, bundle, newer);
        UpdateStore.Launch first = updates.prepare(false);
        check(first.directory == null && !first.pending, "Offline starts signed bundle");

        // A partial release is never selected, and a later complete publish can succeed.
        Map<String, byte[]> partial = new LinkedHashMap<>(newer);
        partial.remove("core.mjs");
        check(store(root, bundle, partial).prepare(true).directory == null, "Partial download changed content");
        Map<String, byte[]> corrupt = new LinkedHashMap<>(newer);
        corrupt.put("core.mjs", bytes("tampered"));
        check(store(root, bundle, corrupt).prepare(true).directory == null, "Bad hash changed content");

        UpdateStore.Launch pending = updates.prepare(true);
        check(pending.pending && pending.directory != null, "Complete release was not staged");
        check(Files.readString(pending.directory.toPath().resolve("core.mjs")).contains("hosted-new-garden"), "Wrong staged content");
        check(store(root, bundle, newer).prepare(false).directory == null, "Unconfirmed launch did not roll back");
        check(store(root, bundle, newer).prepare(true).directory == null, "Broken release retried without a new manifest");

        Map<String, byte[]> fixed = release(5, "fixed-garden");
        updates = store(root, bundle, fixed);
        pending = updates.prepare(true);
        check(pending.pending, "New manifest did not clear quarantine");
        updates.ready(pending.id);
        UpdateStore.Launch active = store(root, bundle, fixed).prepare(false);
        check(active.directory != null && !active.pending && active.id.equals(pending.id), "Offline relaunch lost working update");
        check(store(root, bundle, newer).prepare(true).id.equals(active.id), "Older content downgraded app");

        Map<String, byte[]> next = release(6, "next-garden");
        updates = store(root, bundle, next);
        pending = updates.prepare(true);
        updates.ready(pending.id);
        check(updates.failed(pending.id).id.equals(active.id), "Runtime failure did not restore previous release");
        check(store(root, bundle, next).prepare(false).id.equals(active.id), "Rollback did not persist offline");

        // A malicious manifest path is rejected before any filesystem write.
        Map<String, byte[]> unsafe = new LinkedHashMap<>(next);
        unsafe.put("update.manifest", bytes(new String(next.get("update.manifest"), StandardCharsets.UTF_8)
            + "../escape\t1\t" + hash(bytes("x")) + "\n"));
        check(store(root, bundle, unsafe).prepare(true).id.equals(active.id), "Unsafe path changed content");
        check(!Files.exists(root.getParent().resolve("escape")), "Unsafe path escaped update directory");
        System.out.println("UpdateStore: offline, partial, hash, activation, rollback, downgrade, path checks passed");
    }
}
