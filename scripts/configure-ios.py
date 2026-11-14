#!/usr/bin/env python3
import json
import os
import plistlib
import shutil
import subprocess

APP_NAME = "Canon Tether Studio"
PLIST_PATH = "ios/App/App/Info.plist"
ICON_SRC = "public/app-icon.png"
ICONSET_DIR = "ios/App/App/Assets.xcassets/AppIcon.appiconset"


def update_info_plist() -> None:
    with open(PLIST_PATH, "rb") as f:
        data = plistlib.load(f)

    # Ensure every bundle display/short name field uses spaced words on iPadOS
    data["CFBundleDisplayName"] = APP_NAME
    data["CFBundleName"] = APP_NAME

    # Configure strictly for iPadOS (UIDeviceFamily = 2) with 4-way orientation & multitasking
    data["UIDeviceFamily"] = [2]
    data["UIRequiresFullScreen"] = False
    data["UIStatusBarStyle"] = "UIStatusBarStyleLightContent"
    data["UIViewControllerBasedStatusBarAppearance"] = False
    data["ITSAppUsesNonExemptEncryption"] = False
    data["UISupportedInterfaceOrientations~ipad"] = [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
    ]

    # Allow HTTP local Wi-Fi connections to Canon CCAPI (e.g. http://192.168.1.2:8080)
    data["NSAppTransportSecurity"] = {
        "NSAllowsArbitraryLoads": True,
        "NSAllowsLocalNetworking": True,
    }

    # Required iPadOS / iOS permission prompts
    data["NSLocalNetworkUsageDescription"] = (
        f"{APP_NAME} cần quyền truy cập mạng Wi-Fi cục bộ để kết nối và nhận ảnh từ máy ảnh Canon qua CCAPI."
    )
    data["NSPhotoLibraryAddUsageDescription"] = (
        f"{APP_NAME} cần quyền lưu ảnh chụp từ máy ảnh Canon vào thư viện Ảnh trên iPad."
    )
    data["NSPhotoLibraryUsageDescription"] = (
        f"{APP_NAME} cần quyền chọn ảnh tham chiếu từ thư viện Ảnh trên iPad."
    )

    with open(PLIST_PATH, "wb") as f:
        plistlib.dump(data, f)
    print(f"Updated {PLIST_PATH} with CFBundleDisplayName='{APP_NAME}'")


def generate_app_icons() -> None:
    if not os.path.exists(ICON_SRC):
        raise FileNotFoundError(f"Missing source icon: {ICON_SRC}")

    os.makedirs(ICONSET_DIR, exist_ok=True)
    for entry in os.listdir(ICONSET_DIR):
        if entry.endswith(".png"):
            os.remove(os.path.join(ICONSET_DIR, entry))

    specs = [
        ("ipad", "20x20", "1x", 20, "AppIcon-20.png"),
        ("ipad", "20x20", "2x", 40, "AppIcon-20@2x.png"),
        ("ipad", "29x29", "1x", 29, "AppIcon-29.png"),
        ("ipad", "29x29", "2x", 58, "AppIcon-29@2x.png"),
        ("ipad", "40x40", "1x", 40, "AppIcon-40.png"),
        ("ipad", "40x40", "2x", 80, "AppIcon-40@2x.png"),
        ("ipad", "76x76", "1x", 76, "AppIcon-76.png"),
        ("ipad", "76x76", "2x", 152, "AppIcon-76@2x.png"),
        ("ipad", "83.5x83.5", "2x", 167, "AppIcon-83.5@2x.png"),
        ("iphone", "20x20", "2x", 40, "AppIcon-20@2x-iphone.png"),
        ("iphone", "20x20", "3x", 60, "AppIcon-20@3x-iphone.png"),
        ("iphone", "29x29", "2x", 58, "AppIcon-29@2x-iphone.png"),
        ("iphone", "29x29", "3x", 87, "AppIcon-29@3x-iphone.png"),
        ("iphone", "40x40", "2x", 80, "AppIcon-40@2x-iphone.png"),
        ("iphone", "40x40", "3x", 120, "AppIcon-40@3x-iphone.png"),
        ("iphone", "60x60", "2x", 120, "AppIcon-60@2x.png"),
        ("iphone", "60x60", "3x", 180, "AppIcon-60@3x.png"),
        ("ios-marketing", "1024x1024", "1x", 1024, "AppIcon-512@2x.png"),
    ]

    images_json = []
    for idiom, size_str, scale, px, filename in specs:
        out_path = os.path.join(ICONSET_DIR, filename)
        if px == 1024:
            shutil.copyfile(ICON_SRC, out_path)
        else:
            subprocess.run(
                ["sips", "-z", str(px), str(px), ICON_SRC, "--out", out_path],
                check=True,
                stdout=subprocess.DEVNULL,
            )
        images_json.append(
            {
                "idiom": idiom,
                "size": size_str,
                "scale": scale,
                "filename": filename,
            }
        )

    contents = {
        "images": images_json,
        "info": {"version": 1, "author": "xcode"},
    }
    with open(os.path.join(ICONSET_DIR, "Contents.json"), "w", encoding="utf-8") as f:
        json.dump(contents, f, indent=2)
    print(f"Generated {len(specs)} iPadOS/iOS AppIcon assets in {ICONSET_DIR}")


if __name__ == "__main__":
    update_info_plist()
    generate_app_icons()
