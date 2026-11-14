# Canon Tether Studio

Ứng dụng chụp ảnh tethered không dây hỗ trợ **iPad (iPadOS `.ipa`)**, **điện thoại (Mobile Web)** và **máy tính**, kết nối trực tiếp với máy ảnh Canon qua **Canon Camera Control API (CCAPI)** bằng mạng Wi-Fi cục bộ (`CapacitorHttp`) mà không cần máy tính hay server trung gian.

## Tính năng chính

- **Kết nối CCAPI trực tiếp & Popup trạng thái nhanh**:
  - Nhập địa chỉ IP và Port của máy ảnh Canon (mặc định `8080`) để tự động nhận diện endpoint CCAPI và thông tin thân máy qua Wi-Fi.
  - Bấm nút **Canon Tether Studio** trên thanh tiêu đề để mở popup xem trạng thái kết nối, IP/Port, firmware, kiểm tra kết nối, `Reconnect`, hoặc ngắt kết nối / đổi IP. Khi mất kết nối, nút `Reconnect` nhanh xuất hiện ở góc phải (và tự ẩn khi mở popup để tránh trùng lặp).
  - **Chế độ Test (`0.0.0.0`, Port `8080`)**: Cho phép trải nghiệm và kiểm thử đầy đủ luồng tether ngay trên trình duyệt hoặc thiết bị mà không cần máy ảnh thật.
- **Tether Studio**:
  - Tự động nhận ảnh mới qua Wi-Fi ngay khi bấm chụp trên máy ảnh Canon và đồng bộ ảnh mới từ thẻ nhớ khi cần.
  - Phóng to / thu nhỏ, chụm 2 ngón (`pinch-to-zoom`), kéo rê (`pan`) và chạm đúp / nhấn nút đặt lại khung hình mượt mà.
  - **Histogram pixel thực** (chuyển kênh `RGB`, `L`, `R`, `G`, `B` kèm hiệu ứng chuyển cột mượt và chỉ số vùng tối / sáng gắt) cùng bảng **thông tin ảnh & EXIF** (tên file, dung lượng, Khẩu, Tốc, ISO, Tiêu cự).
  - Tải file gốc (hỗ trợ **iPadOS/iOS Share Sheet** hoặc lưu trực tiếp) và xoá ảnh có bước xác nhận an toàn.
- **So sánh (A / B)**:
  - Đối chiếu song song 2 khung hình, đồng bộ thao tác phóng to / thu nhỏ / kéo rê và đặt lại góc nhìn chung.
  - **Khóa linh hoạt Ảnh A hoặc Ảnh B**: Chọn khóa một khung làm **Tham chiếu** để khung còn lại tự động nhận **Ảnh mới chụp** từ máy ảnh.
  - **Đảo vị trí A ↔ B** với hiệu ứng chuyển đổi trực tiếp toàn thẻ ảnh, nạp ảnh từ thiết bị vào từng khung, và tải file gốc ngay trên khung so sánh.
- **Thư viện**:
  - Hiển thị lưới ảnh gọn gàng chỉ kèm tên file; chạm để mở nhanh trong **Tether Studio**.
  - **Bấm giữ (long-press)** vào ảnh bất kỳ để bật chế độ chọn nhiều (hiển thị ô vuông chọn và thanh thao tác hàng loạt: chọn tất cả, bỏ chọn, tải file gốc hàng loạt, xoá hàng loạt).
  - Nút **`+`** nổi ở góc dưới bên phải để thêm ảnh từ thiết bị.
- **Dải ảnh gần đây & Chuyển tab mượt mà**:
  - Hiệu ứng chuyển tab trượt theo hướng giữa **Tether Studio**, **So sánh**, và **Thư viện**.
  - Dải ảnh gần đây bên dưới hiển thị mặc định trên tablet, máy tính và mobile dọc; mặc định thu gọn trên mobile ngang, và luôn có **nút mũi tên phía dưới để chạm hoặc kéo lên/xuống** đóng mở ở mọi chế độ.
- **Giao diện thích ứng theo thiết bị & hướng màn hình**:
  - **Mobile dọc & iPad dọc**: Thanh 3 tab điều hướng đặt xuống đáy màn hình; Histogram và Thông tin ảnh xếp ngang 2 cột; nút tải và xoá ở **Tether Studio** hiển thị dạng nút vuông chỉ icon ở góc dưới bên phải preview. (Trên mobile ẩn tên máy ảnh ở tiêu đề, trên iPad dọc vẫn giữ tên máy ảnh tại tab **Tether Studio**.)
  - **Mobile ngang**: Chỉ hiển thị vùng preview tối đa trên màn hình, dải ảnh gần đây thu gọn với nút mũi tên kéo ra vào phía dưới.
  - **iPad ngang & Máy tính**: Giao diện thanh điều hướng trên đầu và cột Histogram / thông tin / thao tác bên phải đầy đủ.
- **Phím tắt tiện ích**:
  - `←` / `→`: Chuyển qua lại giữa các ảnh trong dải ảnh gần đây (hoạt động ở mọi chế độ).
  - `=`: Mô phỏng chụp ảnh mới từ máy ảnh *(chỉ hoạt động ở Test Mode `0.0.0.0:8080`)*.
  - `` ` ``: Mô phỏng mất kết nối máy ảnh *(chỉ hoạt động ở Test Mode `0.0.0.0:8080`)*.

## Các dòng máy ảnh Canon hỗ trợ CCAPI

- **EOS R System**: EOS R1, EOS R3, EOS R5, EOS R5 Mark II, EOS R6, EOS R6 Mark II, EOS R6 Mark III, EOS R6 V, EOS R7, EOS R8, EOS RP, EOS R10, EOS R50, EOS R50 V, EOS R100
- **EOS M & DSLR**: EOS M6 Mark II, EOS M50 Mark II, EOS M200, EOS-1D X Mark III, EOS 90D, EOS 850D (Rebel T8i), EOS 250D (Rebel SL3 / 200D II)
- **PowerShot**: PowerShot V10, PowerShot G5 X Mark II, PowerShot G7 X Mark III, PowerShot SX70 HS

## Build file `.ipa` cho iPad qua Codemagic hoặc GitHub Actions

Dự án hỗ trợ chạy Web (`npm run dev` / `npm run build`) và đóng gói bằng **Capacitor** cho **iPadOS (`TARGETED_DEVICE_FAMILY=2`)**:

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
