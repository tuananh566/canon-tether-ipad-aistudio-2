# Canon Tether Studio (iPadOS)

Ứng dụng chụp ảnh tethered không dây dành riêng cho **iPad (iPadOS `.ipa`)**, kết nối trực tiếp với máy ảnh Canon qua **Canon Camera Control API (CCAPI)** bằng mạng Wi-Fi cục bộ (`CapacitorHttp`) mà không cần máy tính hay server trung gian.

## Tính năng chính

- **Kết nối trực tiếp từ iPad tới máy ảnh Canon**: Chỉ cần nhập địa chỉ IP và Port của máy ảnh Canon (mặc định `8080`) để tự động nhận diện thiết bị qua Wi-Fi.
- **Tether Studio**:
  - Tự động nhận ảnh mới qua Wi-Fi ngay khi bạn bấm chụp trên máy ảnh Canon (hỗ trợ đồng bộ ảnh từ thẻ nhớ khi cần).
  - Hỗ trợ chế độ truyền **Siêu tốc (`display`)** hoặc **Ảnh gốc HD (`main`)**, tự động nhận JPEG và bản xem trước từ file RAW (`.CR3` / `.CR2`).
  - Lưới bố cục 1/3, phóng to/thu nhỏ, chụm 2 ngón (pinch-to-zoom) và kéo rê mượt mà trên màn hình cảm ứng iPad.
  - **Histogram pixel thực** (RGB, Luma, R, G, B) kèm chỉ số vùng tối/sáng gắt.
- **So sánh**: Đối chiếu song song 2 khung hình, khóa ảnh tham chiếu B, đảo vị trí, phóng to đồng bộ hoặc nạp ảnh mẫu từ iPad.
- **Thư viện**: Tìm kiếm theo tên file, lens, ISO; lọc theo *Tất cả*, *Từ máy ảnh*, *Từ thiết bị*; chọn nhiều ảnh để lưu file gốc hàng loạt qua **iPadOS Share Sheet** (lưu thẳng vào Ảnh / Tệp) hoặc xóa nhiều ảnh cùng lúc.

## Các dòng máy ảnh Canon hỗ trợ CCAPI

- **EOS R System**: EOS R1, EOS R3, EOS R5, EOS R5 Mark II, EOS R6, EOS R6 Mark II, EOS R6 Mark III, EOS R6 V, EOS R7, EOS R8, EOS RP, EOS R10, EOS R50, EOS R50 V, EOS R100
- **EOS M & DSLR**: EOS M6 Mark II, EOS M50 Mark II, EOS M200, EOS-1D X Mark III, EOS 90D, EOS 850D (Rebel T8i), EOS 250D (Rebel SL3 / 200D II)
- **PowerShot**: PowerShot V10, PowerShot G5 X Mark II, PowerShot G7 X Mark III, PowerShot SX70 HS

## Build file `.ipa` cho iPad qua Codemagic hoặc GitHub Actions

Dự án được đóng gói bằng **Capacitor** dành riêng cho **iPadOS (`TARGETED_DEVICE_FAMILY=2`)**:

### Cách 1: Build trên Codemagic (`codemagic.yaml`)
1. Đẩy mã nguồn (bao gồm file `codemagic.yaml` ở thư mục gốc) lên repository GitHub.
2. Trên Codemagic, bấm **Check for configuration file** để nhận diện workflow **Canon Tether Studio (iPadOS IPA)**.
3. Chạy build để tải artifact `CanonTetherStudio.ipa` tại `build/ios/ipa/CanonTetherStudio.ipa`.

### Cách 2: Build qua GitHub Actions
1. Đẩy mã nguồn lên GitHub (nhánh `main` hoặc `master`).
2. Vào tab **Actions** → chọn **Build iPad IPA (Canon Tether Studio)** (tự động chạy khi push hoặc bấm **Run workflow** để chọn runner `macos-26`, `macos-15`, `macos-latest`, `macos-15-intel`, `macos-26-intel`).
3. Tải artifact **`CanonTetherStudio-iPad-IPA`** sau khi build xong để lấy file `CanonTetherStudio.ipa`.

### Cài đặt lên iPad
- Cài file `CanonTetherStudio.ipa` lên iPad bằng **Sideloadly**, **AltStore** hoặc **SideStore**.
- Khi mở app lần đầu trên iPad, chọn **Cho phép (Allow)** quyền truy cập mạng cục bộ để kết nối với IP Wi-Fi của máy ảnh Canon (bật **Menu → Wireless communication → Camera Control API** trên máy ảnh).
