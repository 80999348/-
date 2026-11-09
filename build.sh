#!/usr/bin/env bash
# 华夏人杰 · 地方志 —— 一键构建脚本
# 依赖：JDK 8+、Android SDK（build-tools 34.0.0 与 platforms;android-34）
# 用法：ANDROID_SDK_ROOT=/path/to/sdk ./build.sh
set -e

BT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}/build-tools/34.0.0"
AJ="${ANDROID_SDK_ROOT:-$HOME/android-sdk}/platforms/android-34/android.jar"
[ -x "$BT/aapt2" ] || { echo "未找到 aapt2，请设置 ANDROID_SDK_ROOT"; exit 1; }

VERSION_CODE=7
VERSION_NAME=1.6
KS=release.keystore

rm -rf build && mkdir -p build/gen build/classes build/dex

echo "[1/6] 编译资源..."
"$BT/aapt2" compile --dir res -o build/res.zip

echo "[2/6] 链接资源与打包 assets..."
"$BT/aapt2" link -o build/base.apk -I "$AJ" \
  --manifest AndroidManifest.xml build/res.zip \
  --java build/gen --min-sdk-version 21 --target-sdk-version 34 -A assets

echo "[3/6] 编译 Java..."
javac --release 8 -nowarn -d build/classes -classpath "$AJ" \
  $(find build/gen -name "*.java") $(find src -name "*.java")

echo "[4/6] 生成 dex..."
"$BT/d8" --lib "$AJ" --min-api 21 --output build/dex $(find build/classes -name "*.class")
(cd build/dex && zip -q -X ../base.apk classes.dex)

echo "[5/6] 对齐..."
"$BT/zipalign" -f 4 build/base.apk build/aligned.apk

echo "[6/6] 签名..."
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias huaxia -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass huaxia2026 -keypass huaxia2026 \
    -dname "CN=Huaxia Renjie, O=Xiaochong Studio"
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias huaxia \
  --ks-pass pass:huaxia2026 --key-pass pass:huaxia2026 \
  --out "华夏人杰-v${VERSION_NAME}.apk" build/aligned.apk

"$BT/apksigner" verify "华夏人杰-v${VERSION_NAME}.apk"
echo "完成：华夏人杰-v${VERSION_NAME}.apk"
