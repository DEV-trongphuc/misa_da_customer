const fs = require('fs');

const dataContent = fs.readFileSync('E:/AUTOFLOW/MISA/data.js', 'utf8');
const scriptCode = dataContent.replace('const misaData =', 'return');
const misaData = (new Function(scriptCode))();

function getLatestInteraction(desc) {
    if (!desc) return "";
    const interactions = desc.split(/(?=\d{1,2}\/\d{1,2}\/?\d{0,4})/);
    return interactions[interactions.length - 1].toLowerCase();
}

let unclassified = [];

misaData.data.forEach(item => {
    let issue = 'Chưa phân loại / Khác';
    const tText = (item.TagIDText || '').toLowerCase();
    const latestNote = getLatestInteraction(item.Description);
    
    if (tText.includes('closed won') || /đã nộp|đã chuyển khoản|thành công|đăng ký xong/i.test(latestNote)) {
        issue = 'Giao dịch thành công';
    } 
    else if (tText.includes('junk') || tText.includes('unqualified')) {
        issue = 'Rác / Data ảo / Sai số';
    }
    else {
        if (/đang chốt|thương lượng|xem hợp đồng|quan tâm cao|xin file|đã gửi/i.test(latestNote)) issue = 'Quan tâm cao / Thương lượng';
        else if (/hẹn gặp|đã hẹn|gặp zoom|lên văn phòng|đặt lịch/i.test(latestNote)) issue = 'Đồng ý thiết lập cuộc hẹn';
        else if (/chưa( có)? nhu cầu|không( có)? nhu cầu|chưa muốn|không học|k học/i.test(latestNote)) issue = 'Không nhu cầu';
        else if (/tài chính|kinh phí|đắt|giá cao|không đủ tiền|lo tiền/i.test(latestNote) && !/không/.test(latestNote)) issue = 'Vấn đề Tài chính';
        else if (/đã mua|bên khác|đối thủ|đang học/i.test(latestNote)) issue = 'Đã mua / Đang dùng bên khác';
        else if (/tham khảo|đợi|chờ|từ từ|chưa quyết/i.test(latestNote)) issue = 'Chưa nhu cầu ngay / Tham khảo';
        else if (/vợ|chồng|bố mẹ|sếp|hỏi ý kiến/i.test(latestNote)) issue = 'Không phải người quyết định';
        else if (/pháp lý|kiểm định|bộ giáo dục|bgd/i.test(latestNote)) issue = 'Hỏi về Pháp lý/Kiểm định';
        else if (/(^|\s)xa(\s|$)|địa lý|ở tỉnh/i.test(latestNote)) issue = 'Khoảng cách Địa lý';
        else if (/thuê bao|tắt máy/i.test(latestNote)) issue = 'Thuê bao / Tắt máy';
        else if (/bận|hẹn|sau gọi|đi làm/i.test(latestNote)) issue = 'Khách bận / Hẹn lại';
        else if (/kbm|knm|k nghe|không bắt máy|không nghe máy/i.test(latestNote)) issue = 'Không Nghe Máy (KNM)';
        else if (/trùng|đã có sale|sale khác|duplicate/i.test(latestNote)) issue = 'Trùng data (Duplicate)';
        else if (/chửi|gắt|phiền|bực|blacklist|đừng gọi/i.test(latestNote)) issue = 'Từ chối gắt / Blacklist';
        else if (/sai số|nhầm|số ảo/i.test(latestNote)) issue = 'Số ảo / Sai số / Nhấn nhầm';
        else if (/lớn tuổi|già|không nghe rõ|không hiểu/i.test(latestNote)) issue = 'Bất đồng ngôn ngữ / Lớn tuổi';
    }

    if (issue === 'Chưa phân loại / Khác' && latestNote.trim() !== '') {
        unclassified.push(latestNote.trim());
    }
});

// Ghi 150 mẫu chưa phân loại ra file để LLM phân tích
let output = unclassified.slice(0, 150);
fs.writeFileSync('E:/AUTOFLOW/MISA/unclassified.txt', output.join('\n---\n'));
console.log("Total unclassified items:", unclassified.length);