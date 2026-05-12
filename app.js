document.addEventListener('DOMContentLoaded', async () => {
    // Check for misaData presence
    if (typeof misaData === 'undefined') {
        console.error("misaData is not defined. Ensure data.js is loaded correctly.");
        return;
    }

    // Register ChartJS DataLabels Plugin
    Chart.register(ChartDataLabels);

    // --- STATE ---
    let rawData = [];
    let state = {
        filteredData: [],
        reps: new Set(),
        issues: new Set(),
        filters: { 
            rep: null,
            issue: null
        }
    };
    let charts = {};

    // --- CHART DEFAULTS ---
    Chart.defaults.font.family = "'Exo 2', sans-serif";
    Chart.defaults.color = '#64748b';

    // --- UTILS & CONSTANTS ---
    const palettePie = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
    const paletteDivergent = ['#10b981', '#34d399', '#94a3b8', '#cbd5e1', '#f87171', '#ef4444'];

    const datalabelsConfig = {
        color: '#ffffff',
        anchor: 'center',
        align: 'center',
        font: { 
            weight: '700', 
            size: 11,
            family: "'Exo 2', sans-serif"
        },
        textStrokeColor: 'rgba(0,0,0,0.3)',
        textStrokeWidth: 1,
        formatter: (value, ctx) => {
            if (ctx.chart.config.type === 'doughnut' || ctx.chart.config.type === 'pie') {
                let sum = 0;
                let dataArr = ctx.chart.data.datasets[0].data;
                dataArr.map(data => { sum += data; });
                return (value * 100 / sum) > 6 ? (value * 100 / sum).toFixed(1) + "%" : null;
            }
            return value.toLocaleString();
        }
    };

    function getGrouped(data, key) {
        return data.reduce((acc, curr) => {
            acc[curr[key]] = (acc[curr[key]] || 0) + 1;
            return acc;
        }, {});
    }

    function createChart(id, config) {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        if(charts[id]) charts[id].destroy();
        charts[id] = new Chart(ctx, config);
    }

    // --- DATA PROCESSING ---
    function processData() {
        rawData = misaData.data.filter(item => {
            const owner = item.OwnerIDText || '';
            const lowerOwner = owner.toLowerCase();
            return !lowerOwner.includes('mai thị nữ') && 
                   !lowerOwner.includes('nguyễn quỳnh anh') && 
                   !lowerOwner.includes('nguyễn ngọc quỳnh');
        });

        rawData.forEach(item => {
            const desc = (item.Description || '').toLowerCase();
            const tText = (item.TagIDText || '').toLowerCase();

            // Store interactions history (Checking dates like 9/4/26)
            const interactionDates = desc.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || [];
            item._interactionCount = interactionDates.length;
            
            // 1. KNM Lifecycle Analysis
            // Đã tinh gọn lại failKeywords chỉ tập trung vào lỗi Không Nghe Máy, loại bỏ "thuê bao/sai số" vì đó là lỗi Data ảo.
            const failKeywords = /knm|kbm|không nghe máy|k nghe máy|k bắt máy|không bắt máy|gọi k|gọi không|đổ chuông/i;
            const hasKNM = failKeywords.test(desc);
            
            if (hasKNM) {
                // Split by date-like patterns or newlines to get individual notes
                const interactions = desc.split(/(?=\d{1,2}\/\d{1,2}\/?\d{0,4})|\n/).filter(line => line.trim().length > 0);
                let knmFoundIndex = -1;
                
                for (let i = 0; i < interactions.length; i++) {
                    if (failKeywords.test(interactions[i])) {
                        knmFoundIndex = i;
                        break;
                    }
                }

                let foundActionAfterKNM = false;
                if (knmFoundIndex !== -1) {
                    // Look for any interaction AFTER the first KNM that is NOT a fail
                    for (let i = knmFoundIndex + 1; i < interactions.length; i++) {
                        // Nếu sau đó có 1 Note dài hơn 5 ký tự và không chứa từ khóa KNM -> Chứng tỏ đã liên lạc được
                        if (!failKeywords.test(interactions[i]) && interactions[i].length > 5) {
                            foundActionAfterKNM = true;
                            break;
                        }
                    }
                }
                item._knmStatus = foundActionAfterKNM ? 'KNM đã Chăm lại' : 'KNM rồi Bỏ luôn';
            } else {
                item._knmStatus = 'Không bị KNM';
            }

            // 6. Lấy Note mới nhất để phân tích
            function getLatestInteraction(desc) {
                if (!desc) return "";
                const interactions = desc.split(/(?=\d{1,2}\/\d{1,2}\/?\d{0,4})/);
                return interactions[interactions.length - 1].toLowerCase();
            }
            const latestNote = getLatestInteraction(item.Description);

            // 2. Actionability (Sửa lỗi quét full text -> Chỉ quét trên Note mới nhất)
            let actionIntent = 'Chăm Sóc Tiếp';
            if (/sai số|nhầm|cháu|nghịch|k nhu cầu|không nhu cầu|nhấn nhầm|rác|spam|đúng số đâu|đang học thpt|ảo|chưa đúng|không đúng/i.test(latestNote)) {
                actionIntent = 'Hệ Thống / Rác (Bỏ luôn)';
            } else if (/chặn|không rep|seen|bỏ luôn|đừng gọi|delete/i.test(latestNote)) {
                actionIntent = 'Hệ Thống / Rác (Bỏ luôn)';
            } else if (item._knmStatus === 'KNM rồi Bỏ luôn') {
                actionIntent = 'Hệ Thống / Rác (Bỏ luôn)';
            }
            if(tText.includes('junk')) actionIntent = 'Hệ Thống / Rác (Bỏ luôn)';
            item._actionIntent = actionIntent;

            // 5. Zalo Connection Status
            let zalo = 'Chưa xác định';
            if(/đã add zalo|đã kết bạn zalo|kb zalo rồi|add zalo rồi|đã kb zalo/i.test(desc)) zalo = 'Đã kết bạn Zalo';
            else if(/chưa add zalo|chưa kb zalo|chưa kết bạn zalo|không có zalo|k có zalo|k thấy zalo/i.test(desc)) zalo = 'Chưa kết bạn Zalo';
            item._zaloStatus = zalo;

            // 6. Lấy Note mới nhất để phân tích
            // Function is already declared at the top of the file/block.
            // Using the one defined earlier.

            let issue = 'Chưa phân loại / Khác';
            
            // LAYER 1: Priorities from Tags or explicit Conversion
            if (tText.includes('closed won') || /đã nộp|đã chuyển khoản|thành công|đăng ký xong/i.test(latestNote)) {
                issue = 'Giao dịch thành công';
            } 
            else if (tText.includes('junk') || tText.includes('unqualified')) {
                issue = 'Rác / Data ảo / Sai số';
            }
            // LAYER 2: Read latest note (Not full history)
            else {
                // Positive / Conversion
                if (/đang chốt|thương lượng|xem hợp đồng|quan tâm cao|xin file|đã gửi/i.test(latestNote)) issue = 'Quan tâm cao / Thương lượng';
                else if (/hẹn gặp|đã hẹn|gặp zoom|lên văn phòng|đặt lịch/i.test(latestNote)) issue = 'Đồng ý thiết lập cuộc hẹn';
                else if (/(đã |add |nhắn |kết bạn |kb |gửi |xin |qua |check )zalo|mail|inbox|gửi tt|gửi thông tin/i.test(latestNote) && !/chặn|không|k thấy|k có|chưa/i.test(latestNote)) issue = 'Đã gửi thông tin / Zalo';
                
                // Refusals / Barriers
                else if (/chưa( có)? nhu cầu|không( có)? nhu cầu|chưa muốn|không học|k học/i.test(latestNote)) issue = 'Không nhu cầu';
                else if (/tài chính|kinh phí|đắt|giá cao|không đủ tiền|lo tiền/i.test(latestNote) && !/không|đánh giá cao/i.test(latestNote)) issue = 'Vấn đề Tài chính';
                else if (/đã mua|bên khác|đối thủ|đang học/i.test(latestNote)) issue = 'Đã mua / Đang dùng bên khác';
                else if (/tham khảo|đợi|chờ|từ từ|chưa quyết|tìm hiểu|cân nhắc|xem thêm/i.test(latestNote)) issue = 'Chưa nhu cầu ngay / Tham khảo';
                else if (/vợ|chồng|bố mẹ|sếp|hỏi ý kiến/i.test(latestNote)) issue = 'Không phải người quyết định';
                else if (/pháp lý|kiểm định|bộ giáo dục|bgd/i.test(latestNote)) issue = 'Hỏi về Pháp lý/Kiểm định';
                else if (/(^|\s)xa(\s|$)|địa lý|ở tỉnh/i.test(latestNote)) issue = 'Khoảng cách Địa lý';
                
                // Contact Status
                else if (/thuê bao|tắt máy/i.test(latestNote)) issue = 'Thuê bao / Tắt máy';
                else if (/bận|hẹn|sau gọi|gọi sau|gọi lại|đi làm|đang dạy|có việc|chăm con|k tiện|không tiện|đang họp/i.test(latestNote)) issue = 'Khách bận / Hẹn lại';
                else if (/kbm|knm|k nghe|không bắt máy|không nghe máy/i.test(latestNote)) issue = 'Không Nghe Máy (KNM)';
                else if (/trùng|đã có sale|sale khác|duplicate/i.test(latestNote)) issue = 'Trùng data (Duplicate)';
                
                // Attitude
                else if (/chửi|gắt|phiền|bực|blacklist|đừng gọi|chặn/i.test(latestNote)) issue = 'Từ chối gắt / Blacklist';
                else if (/sai số|nhầm|số ảo|chưa đúng|không đúng/i.test(latestNote)) issue = 'Số ảo / Sai số / Nhấn nhầm';
                else if (/lớn tuổi|già|không nghe rõ|không hiểu/i.test(latestNote)) issue = 'Bất đồng ngôn ngữ / Lớn tuổi';
            }
            
            // 7. Quality Buckets (Tag-based)
            let q = 'Chưa phân loại / Khác';
            const tagsText = (item.TagIDText || '').toLowerCase();
            if (tagsText === '') q = 'Untag / Mới';
            else if (tagsText.includes('bad timing')) q = 'Bad Timing';
            else if (tagsText.includes('qualified') || tagsText.includes('considering') || tagsText.includes('needed')) q = 'Qualified (C/N)';
            else if (tagsText.includes('unqualified')) q = 'Unqualified';
            else if (tagsText.includes('junk')) q = 'Junk';
            item._qualityBucket = q;
            
            item._issueCat = issue;

            // 4. Demographics
            let degree = 'Chưa xác định';
            if(/cử nhân|đại học/i.test(desc)) degree = 'Cử Nhân / Đại Học';
            else if(/cao đẳng/i.test(desc)) degree = 'Cao Đẳng';
            else if(/thạc sĩ/i.test(desc)) degree = 'Thạc Sĩ';
            else if(/trung cấp/i.test(desc)) degree = 'Trung Cấp';
            item._degree = degree;

            let english = 'Chưa xác định';
            if(/mất gốc|chưa biết|bằng 0|kém|yếu|không biết|số 0|không có/i.test(desc)) english = 'Mất Gốc / Yếu';
            else if(/cơ bản|a1|a2|b1|basic|trung bình|tạm|elementary|beginner/i.test(desc)) english = 'Cơ Bản (A1-B1)';
            else if(/khá|tốt|b2|c1|c2|ielts|fluent|trôi chảy|toeic|giao tiếp tốt|vững/i.test(desc)) english = 'Khá & Tốt (B2+)';
            item._english = english;

            let program = 'Khác';
            if(/dba/i.test(tText + desc)) program = 'DBA';
            else if(/bba|top up/i.test(tText + desc)) program = 'BBA';
            else if(/emba|umef k18/i.test(tText + desc)) program = 'EMBA';
            else if(/mba/i.test(tText + desc)) program = 'MBA';
            else if(/msc ai/i.test(tText + desc)) program = 'MSc AI';
            item._program = program;

            if(item.OwnerIDText) state.reps.add(item.OwnerIDText.replace(/\(NV\d+\)/,'').trim());
            if(item._issueCat) state.issues.add(item._issueCat);
        });

        state.filteredData = [...rawData];
    }

    function updateDashboard() {
        updateKPIs();
        renderPctTables();
        renderDeepCharts();
        renderDataTable();
    }

    // --- TABLE LOGIC ---
    function maskSensitive(text) {
        if (!text) return "";
        // 1. Mask emails
        let masked = text.replace(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@$1');
        // 2. Mask phone numbers (Supports 0xx, 84xx, or direct 9-digit numbers common in CRM notes)
        // Matches sequences of 9-11 digits that start with common phone prefixes
        masked = masked.replace(/(^|[^0-9])((0|84)?[35789]\d{8})($|[^0-9])/g, (match, prefix, phone, cc, suffix) => {
            return prefix + '**********' + suffix;
        });
        return masked;
    }

    function maskPhone(phone) {
        if(!phone) return 'N/A';
        const p = phone.toString().trim();
        if(p.length <= 5) return p;
        return '****' + p.slice(-5);
    }

    function renderDataTable(searchTerm = '') {
        const tbody = document.getElementById('table-body');
        if(!tbody) return;
        
        let displayData = state.filteredData;
        if(searchTerm) {
            const s = searchTerm.toLowerCase();
            displayData = displayData.filter(d => 
                (d.FirstName + ' ' + d.LastName).toLowerCase().includes(s) ||
                (d.Description || '').toLowerCase().includes(s)
            );
        }

        // Limit to 200 for performance
        const limited = displayData.slice(0, 200);
        
        tbody.innerHTML = limited.map(d => `
            <tr>
                <td style="font-weight:600">${d.LeadName || 'N/A'}</td>
                <td style="font-family: monospace">${maskPhone(d.Mobile)}</td>
                <td>${(d.OwnerIDText || '').replace(/\(NV\d+\)/,'')}</td>
                <td><span class="badge ${d._actionIntent === 'Chăm Sóc Tiếp' ? 'tag-potential' : 'tag-bad'}">${d._issueCat}</span></td>
                <td class="cell-description" data-full-note="${(maskSensitive(d.Description) || '').replace(/"/g, '&quot;')}">${maskSensitive(d.Description) || ''}</td>
            </tr>
        `).join('');

        // Attach modal events to new rows
        tbody.querySelectorAll('.cell-description').forEach(cell => {
            cell.addEventListener('click', () => {
                const fullNote = cell.getAttribute('data-full-note');
                showNoteModal(fullNote);
            });
        });

        document.getElementById('table-count-info').textContent = `Hiển thị ${limited.length} trên tổng số ${displayData.length} lead đã lọc.`;
    }

    function showNoteModal(note) {
        const modal = document.getElementById('note-modal');
        const body = document.getElementById('modal-note-body');
        if(!modal || !body) return;
        body.textContent = note;
        modal.classList.add('active');
    }

    document.getElementById('close-modal')?.addEventListener('click', () => {
        document.getElementById('note-modal').classList.remove('active');
    });

    document.getElementById('note-modal')?.addEventListener('click', (e) => {
        if(e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });

    document.getElementById('table-search-input')?.addEventListener('input', (e) => {
        renderDataTable(e.target.value);
    });

    function updateKPIs() {
        // Update Date Range Display
        if(misaData.range_used) {
            const from = misaData.range_used.from_date;
            const to = misaData.range_used.to_date;
            document.getElementById('report-date-range').textContent = `Dữ liệu từ: ${from} đến ${to}`;
        }

        const total = state.filteredData.length;
        let followup = 0, drop = 0, knm = 0;

        state.filteredData.forEach(d => {
            if(d._actionIntent === 'Chăm Sóc Tiếp') {
                followup++;
            } else {
                // Chỉ đếm vào Rác/Xấu nếu không phải là nhóm KNM Bỏ luôn (đã có KPI riêng)
                if (d._knmStatus !== 'KNM rồi Bỏ luôn') {
                    drop++;
                }
            }
            
            // KPI Khách Không Nghe Máy (Chỉ tính nhóm chưa được chăm sóc lại/đã bỏ)
            if(d._knmStatus === 'KNM rồi Bỏ luôn') {
                knm++;
            }
        });

        document.getElementById('kpi-total').textContent = total.toLocaleString();
        document.getElementById('kpi-followup').textContent = followup.toLocaleString();
        document.getElementById('kpi-drop').textContent = drop.toLocaleString();
        document.getElementById('kpi-knm').textContent = knm.toLocaleString();
    }

    function renderPctTables() {
        const total = state.filteredData.length || 1;
        
        const issObj = getGrouped(state.filteredData, '_issueCat');
        const sortedIss = Object.entries(issObj).sort((a,b) => b[1]-a[1]);
        const tIssBody = document.getElementById('table-issues').querySelector('tbody');
        tIssBody.innerHTML = sortedIss.map(([label, count]) => `
            <tr><td>${label}</td><td>${count}</td><td>${((count/total)*100).toFixed(1)}%</td></tr>
        `).join('');
    }

    function renderDeepCharts() {
        // 1. Degree
        const degObj = getGrouped(state.filteredData, '_degree');
        createChart('chartDegree', {
            type: 'doughnut',
            data: { labels: Object.keys(degObj), datasets: [{ data: Object.values(degObj), backgroundColor: palettePie }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: datalabelsConfig, legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
        });

        // 2. English
        const engObj = getGrouped(state.filteredData, '_english');
        createChart('chartEnglish', {
            type: 'bar',
            data: { labels: Object.keys(engObj), datasets: [{ label: 'Lead', data: Object.values(engObj), backgroundColor: '#3b82f6', borderRadius: 5 }] },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { y: { beginAtZero: true } }, 
                plugins: { 
                    legend: { display: false },
                    datalabels: datalabelsConfig
                } 
            }
        });

        // 3. Program
        const progObj = getGrouped(state.filteredData, '_program');
        createChart('chartProgram', {
            type: 'pie',
            data: { labels: Object.keys(progObj), datasets: [{ data: Object.values(progObj), backgroundColor: palettePie }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: datalabelsConfig, legend: { position: 'bottom' } } }
        });

        // 4. KNM Lifecycle
        const knmObj = getGrouped(state.filteredData.filter(d => d._knmStatus !== 'Không bị KNM'), '_knmStatus');
        
        const knmConfig = [
            { label: 'KNM đã Chăm lại', color: '#10b981', value: knmObj['KNM đã Chăm lại'] || 0 },
            { label: 'KNM rồi Bỏ luôn', color: '#ef4444', value: knmObj['KNM rồi Bỏ luôn'] || 0 }
        ].filter(x => x.value > 0);

        createChart('chartKNMLifecycle', {
            type: 'doughnut',
            data: { 
                labels: knmConfig.map(x => x.label), 
                datasets: [{ 
                    data: knmConfig.map(x => x.value), 
                    backgroundColor: knmConfig.map(x => x.color), 
                    cutout: '60%' 
                }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { 
                    datalabels: datalabelsConfig,
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Tỷ lệ phục hồi khách KNM', font: { weight: '600' } }
                } 
            }
        });


        // 7. Quality Bucket Chart
        const qData = { 'Qualified (C/N)': 0, 'Bad Timing': 0, 'Unqualified': 0, 'Junk': 0, 'Untag / Mới': 0, 'Chưa phân loại / Khác': 0 };
        state.filteredData.forEach(d => {
            if(qData[d._qualityBucket] !== undefined) qData[d._qualityBucket]++;
        });

        // Filter out zero values
        const filteredEntries = Object.entries(qData).filter(([_, count]) => count > 0);
        const labels = filteredEntries.map(e => e[0]);
        const values = filteredEntries.map(e => e[1]);

        // Consistent Color Mapping
        const colorMap = {
            'Qualified (C/N)': '#10b981',
            'Bad Timing': '#facc15',
            'Unqualified': '#f87171',
            'Junk': '#64748b',
            'Untag / Mới': '#cbd5e1',
            'Chưa phân loại / Khác': '#94a3b8'
        };

        createChart('chartQuality', {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lượng Lead',
                    data: values,
                    backgroundColor: labels.map(l => colorMap[l] || '#cbd5e1'),
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    datalabels: datalabelsConfig
                }
            }
        });

        // 6. Performance (Stacked with Recovery focus)
        const perf = {};
        state.filteredData.forEach(d => {
            const rep = (d.OwnerIDText || 'Ẩn danh').replace(/\(NV\d+\)/,'').trim();
            if(!perf[rep]) perf[rep] = { care: 0, drop: 0 };
            if(d._actionIntent === 'Chăm Sóc Tiếp') perf[rep].care++;
            else perf[rep].drop++;
        });
        const sortedPerf = Object.entries(perf).sort((a,b) => (b[1].care + b[1].drop) - (a[1].care + a[1].drop)).slice(0, 10);
        
        createChart('chartPerformance', {
            type: 'bar',
            data: {
                labels: sortedPerf.map(i => i[0]),
                datasets: [
                    { label: 'Tỷ lệ Rác/Bỏ', data: sortedPerf.map(i => i[1].drop), backgroundColor: '#cbd5e1' },
                    { label: 'Tỷ lệ Tiềm năng', data: sortedPerf.map(i => i[1].care), backgroundColor: '#3b82f6' }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: { legend: { position: 'bottom' }, datalabels: { display: false } }
            }
        });


    }

    function setupDropdowns() {
        // --- TOP FILTERS ---
        // 1. Issue Dropdown
        const issuesArray = ['Tất cả Lý do', ...Array.from(state.issues).sort()];
        initDropdown('dropdown-issue', issuesArray, (val) => {
            state.filters.issue = val === 'Tất cả Lý do' ? null : val;
            syncDropdowns('issue', val);
            applyFilters();
        });

        // 2. Rep Dropdown
        const repsArray = ['Tất cả Nhân sự', ...Array.from(state.reps).sort()];
        initDropdown('dropdown-rep', repsArray, (val) => {
            state.filters.rep = val === 'Tất cả Nhân sự' ? null : val;
            applyFilters();
        });

        // --- TABLE FILTERS (Sync with top) ---
        initDropdown('table-dropdown-issue', issuesArray, (val) => {
            state.filters.issue = val === 'Tất cả Lý do' ? null : val;
            syncDropdowns('issue', val);
            applyFilters();
        });
    }

    function syncDropdowns(type, value) {
        const topId = 'dropdown-issue';
        const tableId = 'table-dropdown-issue';
        
        [topId, tableId].forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.querySelector('.dropdown-selected span').textContent = value;
                el.querySelectorAll('.dropdown-menu li').forEach(li => {
                    if(li.textContent === value) li.classList.add('selected');
                    else li.classList.remove('selected');
                });
            }
        });
    }

    function initDropdown(id, items, onSelect) {
        const el = document.getElementById(id);
        if(!el) return;
        const selectedLabel = el.querySelector('.dropdown-selected span');
        const menu = el.querySelector('.dropdown-menu');

        el.querySelector('.dropdown-selected').addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown').forEach(d => {
                if(d !== el) d.classList.remove('active');
            });
            el.classList.toggle('active');
        });

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.textContent = item;
            if(index === 0) li.classList.add('selected');
            li.addEventListener('click', () => {
                selectedLabel.textContent = item;
                menu.querySelectorAll('li').forEach(l => l.classList.remove('selected'));
                li.classList.add('selected');
                el.classList.remove('active');
                onSelect(item);
            });
            menu.appendChild(li);
        });
    }

    function applyFilters() {
        state.filteredData = rawData.filter(item => {
            const repMatch = !state.filters.rep || (item.OwnerIDText || '').includes(state.filters.rep);
            const issueMatch = !state.filters.issue || (item._issueCat && item._issueCat.trim() === state.filters.issue.trim());
            return repMatch && issueMatch;
        });
        updateDashboard();
    }

    document.addEventListener('click', (e) => { 
        if(!e.target.closest('.custom-dropdown')) {
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
        }
    });

    // --- INIT ---
    processData();
    setupDropdowns();
    updateDashboard();
});
