#!/usr/bin/env python3
"""Build and test public sources in a Linux sandbox; never install dependencies."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = {"src", "tests", "public", "examples", "assets", "licenses", "docs", "scripts", ".github"}
ROOT_FILES = {"package.json", "package-lock.json", "index.html", "vite.config.mjs",
              "README.md", "LICENSE", "LICENSE.md", "NOTICE", "THIRD_PARTY_NOTICES.md",
              "CONTRIBUTING.md", "SECURITY.md", "PRODUCT.md", "DESIGN.md", ".gitignore", ".gitattributes"}
OMIT = {".git", "node_modules", "dist", ".test-build", "__pycache__", "data", "dados"}


def reject(message):
    raise RuntimeError(message)


def signature(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid,
            info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def private_name(name):
    return name in OMIT or name.startswith(".env") or name in {".npmrc", ".pypirc", ".yarnrc"}


def public_files(root):
    result = []
    for item in sorted(root.iterdir()):
        if item.name in ROOT_FILES:
            result.append(item)
        elif item.name in DIRECTORIES:
            if item.is_symlink() or not item.is_dir():
                reject("Source directory must be a real directory: " + item.name)
            for current, directories, files in os.walk(item, followlinks=False):
                directories[:] = sorted(n for n in directories if not private_name(n))
                for name in directories:
                    if (Path(current) / name).is_symlink():
                        reject("Source directory symlink refused: " + name)
                result.extend(Path(current) / n for n in sorted(files) if not private_name(n))
    return sorted(result)


def dependency_files(root):
    result = []
    for current, directories, files in os.walk(root, followlinks=False):
        result.extend(Path(current) / name for name in sorted(directories + files))
    return sorted(result)


def snapshot(root, paths, allow_links=False):
    digest = hashlib.sha256()
    for path in paths:
        info = path.lstat()
        relative = path.relative_to(root).as_posix()
        digest.update((relative + "\0" + oct(stat.S_IMODE(info.st_mode)) + "\0").encode())
        if stat.S_ISLNK(info.st_mode):
            if not allow_links or not path.resolve(strict=True).is_relative_to(root):
                reject("External or source symlink refused: " + relative)
            digest.update(("link\0" + os.readlink(path) + "\0").encode())
        elif stat.S_ISDIR(info.st_mode):
            digest.update(b"directory\0")
        elif stat.S_ISREG(info.st_mode) and info.st_nlink == 1:
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
            with os.fdopen(fd, "rb") as stream:
                if signature(os.fstat(stream.fileno())) != signature(info):
                    reject("File changed while opening: " + relative)
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
                if signature(os.fstat(stream.fileno())) != signature(info) or signature(path.lstat()) != signature(info):
                    reject("File changed while hashing: " + relative)
            digest.update(b"\0")
        else:
            reject("Nonregular file or hardlink refused: " + relative)
    return digest.hexdigest()


def publish(source):
    if not (source / "index.html").is_file():
        reject("Client build has no index.html")
    expected = snapshot(source, dependency_files(source))
    destination = ROOT / "dist"
    if destination.is_symlink() or destination.exists() and not destination.is_dir():
        reject("Existing dist must be a real directory")
    temporary = Path(tempfile.mkdtemp(prefix=".dist-offline-", dir=ROOT))
    backup = temporary / "previous"
    committed = False
    try:
        shutil.copytree(source, temporary / "ready")
        if snapshot(temporary / "ready", dependency_files(temporary / "ready")) != expected:
            reject("Client build changed during publication")
        if destination.exists():
            destination.rename(backup)
        try:
            (temporary / "ready").rename(destination)
            committed = True
        except BaseException:
            if backup.exists():
                backup.rename(destination)
            raise
    finally:
        if committed or not backup.exists():
            shutil.rmtree(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", required=True, type=Path)
    parser.add_argument("--deps", required=True, type=Path)
    parser.add_argument("--acceptance", type=Path)
    args = parser.parse_args()
    if not args.node.is_absolute() or not args.deps.is_absolute():
        reject("--node and --deps must be absolute paths")
    node, dependencies = args.node.resolve(strict=True), args.deps.resolve(strict=True)
    if not node.is_file() or not os.access(node, os.X_OK) or not dependencies.is_dir():
        reject("Supply an executable Node binary and an existing dependency directory")
    bwrap, setpriv = shutil.which("bwrap"), shutil.which("setpriv")
    if not bwrap or not setpriv:
        reject("Linux bubblewrap and setpriv are required; no unsandboxed fallback is used")
    acceptance = args.acceptance.resolve(strict=True) if args.acceptance else None
    if acceptance and not acceptance.is_dir():
        reject("--acceptance must be an existing directory")
    acceptance_hash = snapshot(acceptance, dependency_files(acceptance)) if acceptance else None
    source_hash = snapshot(ROOT, public_files(ROOT))
    dependency_hash = snapshot(dependencies, dependency_files(dependencies), allow_links=True)
    with tempfile.TemporaryDirectory(prefix="lofrano-offline-", dir="/tmp") as directory:
        work = Path(directory) / "source"
        work.mkdir()
        for source in public_files(ROOT):
            target = work / source.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target, follow_symlinks=False)
        if snapshot(work, public_files(work)) != source_hash:
            reject("Public sources changed while copying")
        if not (work / "scripts/check-proof.mjs").is_file():
            reject("Missing scripts/check-proof.mjs")
        for name in ("node_modules", ".test-build", "dist"):
            (work / name).mkdir()
        # A root runner's new user namespace cannot traverse the runner-owned
        # /home directory. Stage only validated dependencies and the exact Node
        # binary in this owned temporary root; never relax home permissions.
        staged_dependencies = Path(directory) / "dependencies"
        shutil.copytree(dependencies, staged_dependencies, symlinks=True)
        if snapshot(staged_dependencies, dependency_files(staged_dependencies), allow_links=True) != dependency_hash:
            reject("Dependencies changed while staging")
        staged_node = Path(directory) / "node"
        shutil.copy2(node, staged_node)
        node_hash = hashlib.sha256(node.read_bytes()).hexdigest()
        if hashlib.sha256(staged_node.read_bytes()).hexdigest() != node_hash:
            reject("Node changed while staging")
        staged_acceptance = None
        if acceptance:
            staged_acceptance = Path(directory) / "acceptance"
            shutil.copytree(acceptance, staged_acceptance, symlinks=True)
            if snapshot(staged_acceptance, dependency_files(staged_acceptance)) != acceptance_hash:
                reject("Independent acceptance changed while staging")
        ssr, client = Path(directory) / "ssr", Path(directory) / "client"
        ssr.mkdir()
        client.mkdir()
        command = [setpriv, "--no-new-privs", bwrap, "--unshare-all", "--unshare-user",
                   "--disable-userns", "--assert-userns-disabled", "--cap-drop", "ALL",
                   "--die-with-parent", "--new-session", "--tmpfs", "/", "--ro-bind", "/usr", "/usr"]
        for name in ("/bin", "/sbin", "/lib", "/lib64"):
            path = Path(name)
            if path.is_symlink():
                command += ["--symlink", os.readlink(path), name]
            elif path.exists():
                command += ["--ro-bind", name, name]
        if Path("/etc/ld.so.cache").is_file():
            command += ["--ro-bind", "/etc/ld.so.cache", "/etc/ld.so.cache"]
        command += ["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
                    "--dir", "/tmp/home", "--dir", "/tmp/config", "--dir", "/tmp/cache",
                    "--dir", "/runtime", "--ro-bind", str(staged_node), "/runtime/node",
                    "--ro-bind", str(work), "/work", "--ro-bind", str(staged_dependencies), "/work/node_modules",
                    "--bind", str(ssr), "/work/.test-build", "--bind", str(client), "/work/dist",
                    "--clearenv", "--chdir", "/work"]
        for key, value in {"PATH": "/runtime:/usr/bin:/bin", "HOME": "/tmp/home", "TMPDIR": "/tmp",
                           "XDG_CONFIG_HOME": "/tmp/config", "XDG_CACHE_HOME": "/tmp/cache",
                           "LANG": "C.UTF-8", "TZ": "UTC", "CI": "true", "NO_COLOR": "1"}.items():
            command += ["--setenv", key, value]
        if acceptance:
            command += ["--ro-bind", str(staged_acceptance), "/acceptance", "--setenv", "RECIPE_ENGINE_URL", "file:///work/src/engine.js"]
        command += ["--remount-ro", "/", "--", "/runtime/node", "/work/scripts/check-proof.mjs"]
        try:
            result = subprocess.run(command, stdin=subprocess.DEVNULL, timeout=240,
                                    env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
        finally:
            if acceptance and snapshot(acceptance, dependency_files(acceptance)) != acceptance_hash:
                reject("Independent acceptance changed")
            if staged_acceptance and snapshot(staged_acceptance, dependency_files(staged_acceptance)) != acceptance_hash:
                reject("Sandbox independent acceptance changed")
            if snapshot(ROOT, public_files(ROOT)) != source_hash:
                reject("Original public sources changed")
            if snapshot(dependencies, dependency_files(dependencies), allow_links=True) != dependency_hash:
                reject("Original dependencies changed")
            if snapshot(work, public_files(work)) != source_hash:
                reject("Sandbox source snapshot changed")
            if snapshot(staged_dependencies, dependency_files(staged_dependencies), allow_links=True) != dependency_hash:
                reject("Sandbox dependencies changed")
            if hashlib.sha256(staged_node.read_bytes()).hexdigest() != node_hash or hashlib.sha256(node.read_bytes()).hexdigest() != node_hash:
                reject("Node binary changed")
        if result.returncode:
            reject("Offline child failed (exit %d); no dist published. Check sandbox support and test output." % result.returncode)
        publish(client)
    print(json.dumps({"offline_check": "passed", "child_exit": 0, "source_sha256": source_hash,
                      "dependencies_sha256": dependency_hash, "acceptance_sha256": acceptance_hash,
                      "node_sha256": node_hash, "browser_qa": False}))


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        print("check-offline: " + str(error), file=sys.stderr)
        raise SystemExit(1)
