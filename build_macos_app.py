#!/usr/bin/env python3
"""Gera um aplicativo macOS offline com os arquivos do ARQON Software Engineering Studio."""

import plistlib
import shutil
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dist" / "ARQON Software Engineering Studio.app"
WEB_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".woff2", ".txt"}


def main():
    if sys.platform != "darwin":
        print("Este empacotador requer macOS.", file=sys.stderr)
        return 1
    swiftc = shutil.which("swiftc")
    if not swiftc:
        print("O compilador Swift do Xcode Command Line Tools não foi encontrado.", file=sys.stderr)
        return 1

    OUTPUT.parent.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix="brmodelo-build-") as temporary:
        staging = Path(temporary) / OUTPUT.name
        contents = staging / "Contents"
        executable = contents / "MacOS" / "ARQON Software Engineering Studio"
        resources = contents / "Resources" / "web"
        executable.parent.mkdir(parents=True)
        resources.mkdir(parents=True)
        for source in ROOT.rglob("*"):
            if not source.is_file() or source.is_symlink() or source.suffix not in WEB_SUFFIXES:
                continue
            relative = source.relative_to(ROOT)
            if any(part in {"dist", "tests", "__pycache__"} for part in relative.parts):
                continue
            destination = resources / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        shutil.copy2(ROOT / "brmodelo.py", resources / "brmodelo.py")

        with (contents / "Info.plist").open("wb") as plist:
            plistlib.dump({
                "CFBundleDevelopmentRegion": "pt_BR",
                "CFBundleDisplayName": "ARQON Software Engineering Studio",
                "CFBundleExecutable": "ARQON Software Engineering Studio",
                "CFBundleIdentifier": "br.com.erlaniofreire.brmodelostudio",
                "CFBundleInfoDictionaryVersion": "6.0",
                "CFBundleName": "ARQON Software Engineering Studio",
                "CFBundlePackageType": "APPL",
                "CFBundleShortVersionString": "0.1.0",
                "CFBundleVersion": "1",
                "LSMinimumSystemVersion": "11.0",
                "LSUIElement": True,
                "NSHighResolutionCapable": True,
            }, plist)

        subprocess.run([
            swiftc, "-O", "-framework", "AppKit", "-module-cache-path",
            str(Path(temporary) / "swift-cache"), str(ROOT / "macos" / "Launcher.swift"),
            "-o", str(executable),
        ], check=True)
        subprocess.run(["codesign", "--force", "--sign", "-", str(staging)], check=True)
        if OUTPUT.exists():
            shutil.rmtree(OUTPUT)
        shutil.move(staging, OUTPUT)

    print(f"Aplicativo criado: {OUTPUT}")
    print("Abra com duplo clique; use o ícone na barra de menus para encerrar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
