// small helpers for the PHP app
function requestNotify() {
  if (!('Notification' in window)) { alert('এই ব্রাউজারে নোটিফিকেশন সাপোর্ট করে না'); return; }
  Notification.requestPermission().then(function (p) {
    if (p === 'granted') {
      new Notification('কাজের হিসাব', { body: 'রিমাইন্ডার নোটিফিকেশন চালু হয়েছে ✅' });
    } else {
      alert('নোটিফিকেশন অনুমতি দেওয়া হয়নি');
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // confirm on destructive bulk actions
  document.querySelectorAll('form').forEach(function (form) {
    var select = form.querySelector('select[name="bulk_action"]');
    if (!select) return;
    form.addEventListener('submit', function (e) {
      var boxes = form.querySelectorAll('input[name="items[]"]:checked');
      if (!boxes.length && !form.querySelector('input[name="ids[]"]')) {
        e.preventDefault();
        alert('প্রথমে কাজ সিলেক্ট করুন (বাল্ক অ্যাকশন তালিকার চেকবক্স ব্যবহার করুন)');
      }
    });
  });
});
