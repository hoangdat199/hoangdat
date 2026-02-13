/* =========================================================
   Tương_tác_trang_chủ.js —— Kịch bản tương tác trang chủ SillyTavern (Thân thiện với tiêm .load)
   Mục tiêu:
   - Liên kết nút thông qua ủy quyền sự kiện data-action (không phụ thuộc onclick)
   - Hỗ trợ: chuyển đổi swipe mở đầu / sao chép số nhóm QQ / mở liên kết
   - Tương thích: có hoặc không có triggerSlash / getChatMessages / setChatMessage
   Sử dụng:
   - Thêm vào cuối HTML được tiêm: <script src=".../Tương_tác_trang_chủ.js"></script>
   - Đánh dấu trên các phần tử HTML các thuộc tính data-action / data-swipe / data-url / data-qq
   ========================================================= */

(function () {
  'use strict';

  // Ngăn chặn tải lại dẫn đến liên kết lặp lại
  if (window.__MDW_HOME_INTERACT_LOADED__) return;
  window.__MDW_HOME_INTERACT_LOADED__ = true;

  // ---------------------------
  // Công cụ nhỏ: Thông báo tin nhắn
  // ---------------------------
  function toast(msg, severity = 'info') {
    // Trong môi trường SillyTavern nhiều tác giả dùng triggerSlash
    if (typeof window.triggerSlash === 'function') {
      window.triggerSlash(`/echo severity=${severity} ${msg}`);
      return;
    }
    // Phương án dự phòng (fallback)
    try {
      console.log(`[HOME:${severity}]`, msg);
    } catch {}
    // Phương án cuối cùng
    if (severity === 'error' || severity === 'warning') {
      try {
        alert(msg);
      } catch {}
    }
  }

  // ---------------------------
  // Sao chép văn bản (Clipboard)
  // ---------------------------
  async function copyText(text) {
    if (!text) return toast('Không có nội dung để sao chép.', 'warning');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast('Đã sao chép vào khay nhớ tạm!', 'success');
        return;
      }
      // Phương án thay thế (khi không có API)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-999999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) toast('Đã sao chép vào khay nhớ tạm!', 'success');
      else toast(`Sao chép thất bại, vui lòng sao chép thủ công: ${text}`, 'error');
    } catch (e) {
      toast(`Sao chép thất bại, vui lòng sao chép thủ công: ${text}`, 'error');
    }
  }

  // ---------------------------
  // Mở liên kết (Tab mới)
  // ---------------------------
  function openLink(url) {
    if (!url) return toast('Thiếu địa chỉ liên kết (data-url).', 'error');
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast(`Không thể mở liên kết, vui lòng sao chép thủ công: ${url}`, 'error');
    }
  }

  // ---------------------------
  // Chuyển đổi swipe mở đầu (Phụ thuộc vào API do ST/Trợ lý cung cấp)
  // ---------------------------
  async function switchOpeningSwipe(swipeId, clickedEl) {
    // Phản hồi giao diện (UI)
    if (clickedEl) {
      clickedEl.classList.add('is-disabled');
      clickedEl.classList.add('is-selected');
    }

    // Kiểm tra phụ thuộc
    const hasGet = typeof window.getChatMessages === 'function';
    const hasSet = typeof window.setChatMessage === 'function';

    if (!hasGet || !hasSet) {
      toast('Môi trường hiện tại chưa hiển thị getChatMessages / setChatMessage, không thể tự động chuyển đổi mở đầu.', 'warning');
      toast('Bạn có thể trượt/chuyển đổi swipes thủ công trên tin nhắn thứ 0.', 'info');
      if (clickedEl) clickedEl.classList.remove('is-disabled');
      return;
    }

    try {
      // swipeId theo logic gốc của bạn: messages[0].swipes[swipeId]
      const messages = await window.getChatMessages('0', { include_swipe: true });
      const msg0 = messages && messages[0];

      if (!msg0) throw new Error('Không tìm thấy tin nhắn thứ 0 (messages[0]).');

      // Có môi trường swipes có thể là mảng, có thể là đối tượng; ở đây tương thích cả hai
      const swipes = msg0.swipes;
      const target = swipes ? swipes[swipeId] : null;

      if (!target) {
        throw new Error(`Không tìm thấy swipe mở đầu ${swipeId}. Vui lòng xác nhận đã thêm swipes theo thứ tự.`);
      }

      await window.setChatMessage(target, 0, {
        swipe_id: swipeId,
        refresh: 'display_and_render_current',
      });

      toast(`Đã chuyển sang mở đầu ${swipeId}.`, 'success');
    } catch (e) {
      toast(`Chuyển đổi thất bại: ${e && e.message ? e.message : String(e)}`, 'error');
      if (clickedEl) {
        clickedEl.classList.remove('is-selected');
      }
    } finally {
      if (clickedEl) clickedEl.classList.remove('is-disabled');
    }
  }

  // ---------------------------
  // Ủy quyền sự kiện: Xử lý thống nhất data-action
  // ---------------------------
  function onClick(e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.getAttribute('data-action');

    // 1) Sao chép QQ
    if (action === 'copy-qq') {
      const qq = el.getAttribute('data-qq') || '';
      return copyText(qq);
    }

    // 2) Mở liên kết
    if (action === 'open-link') {
      const url = el.getAttribute('data-url') || '';
      return openLink(url);
    }

    // 3) Chuyển đổi mở đầu
    if (action === 'switch-opening') {
      const raw = el.getAttribute('data-swipe');
      const swipeId = Number(raw);
      if (!Number.isFinite(swipeId)) {
        return toast('Thiếu hoặc sai data-swipe (phải là số).', 'error');
      }

      // Hủy trạng thái chọn các thẻ khác (trong cùng nhóm)
      try {
        document.querySelectorAll('[data-action="switch-opening"].is-selected').forEach((node) => {
          if (node !== el) node.classList.remove('is-selected');
        });
      } catch {}

      return switchOpeningSwipe(swipeId, el);
    }

    // Action không xác định
    toast(`Action không xác định: ${action}`, 'warning');
  }

  document.addEventListener('click', onClick);

  // ---------------------------
  // Nhắc nhở khởi tạo (có thể xóa)
  // ---------------------------
  toast('Tương tác trang chủ đã được tải.', 'info');
})();
