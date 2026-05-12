// --- DATA FETCHING & INITIALIZATION ---
// rawAlumniData loaded from alumni_data.js
let uniquePeople = [];
let multiSchoolPeople = [];
let currentFilteredData = [];
let currentFilteredUnique = [];

const PAGE_SIZE = 50;
let dirCurrentPage = 1;
let dirFilteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    if (typeof rawAlumniData === 'undefined') {
        document.getElementById('header-total').textContent = "Lỗi tải dữ liệu";
        return;
    }
    processData();
});

// --- DATA PROCESSING & MASKING ---
function maskEmail(email) {
    if (!email) return '';
    email = email.trim().toLowerCase();
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return name[0] + '****@' + domain;
    return name[0] + '****' + name[name.length - 1] + '@' + domain;
}

function maskPhone(phoneStr) {
    if (!phoneStr) return '';
    if (phoneStr.length <= 4) return phoneStr;
    return '****' + phoneStr.slice(-4);
}

function normalizePhone(val) {
    if (!val) return '';
    let p = String(val).split('.')[0];
    if (!p.startsWith('0') && p.length > 5) p = '0' + p;
    return p;
}

function getYearFromDob(dob) {
    if (!dob) return 'Unknown';
    const parts = String(dob).split('/');
    const year = parts[parts.length - 1];
    if (year && year.length === 4) return year;
    return 'Unknown';
}

function groupTitle(title) {
    if (!title || title.trim() === '') return 'Chưa cập nhật';
    const t = title.toLowerCase();

    if (t.match(/\b(phó giám đốc|phó tổng|vice|deputy director)\b/)) return 'Phó Giám đốc / VP';
    if (t.match(/\b(ceo|cfo|cto|cmo|coo|cio|chief|giám đốc|tổng giám đốc|chủ tịch|founder|co-founder|owner|chủ doanh nghiệp)\b/)) return 'Giám đốc / C-Level';
    if (t.match(/\b(director)\b/)) return 'Director';
    if (t.match(/\b(manager|trưởng phòng|quản đốc|quản lý|head|trưởng ban|trưởng nhóm|tổ trưởng|leader|captain|chỉ huy)\b/)) return 'Quản lý / Manager';
    if (t.match(/\b(supervisor|giám sát|phó phòng|phó ban|phó nhóm|deputy manager)\b/)) return 'Phó phòng / Supervisor';
    if (t.match(/\b(it|software|developer|dev|kỹ sư|engineer|coder|lập trình|kỹ thuật|data|system|network|frontend|backend|fullstack|tester|qa|qc)\b/)) return 'Kỹ thuật / IT / Software';
    if (t.match(/\b(consultant|cố vấn|tư vấn|advisor|chuyên gia)\b/)) return 'Chuyên gia / Consultant';
    if (t.match(/\b(giảng viên|giáo viên|teacher|lecturer|trợ giảng|đào tạo|trainer)\b/)) return 'Giảng viên / Đào tạo';
    if (t.match(/\b(bác sĩ|dược sĩ|điều dưỡng|y tá|doctor|nurse|thầy thuốc)\b/)) return 'Y tế / Sức khỏe';
    if (t.match(/\b(chuyên viên|nhân viên|executive|staff|officer|assistant|trợ lý|kế toán|analyst|chuyên trách|thư ký)\b/)) return 'Nhân viên / Chuyên viên';
    if (t.match(/\b(sinh viên|student|thực tập|intern)\b/)) return 'Sinh viên / Thực tập';

    if (t === 'chưa cập nhật' || t === 'n/a' || t === 'none' || t === 'không') return 'Chưa cập nhật';
    return 'Chuyên môn Khác';
}

function processData() {
    let personMap = {};
    
    rawAlumniData.forEach(d => {
        d._phoneStr = normalizePhone(d.phone);
        d._mailStr = d.mail ? String(d.mail).toLowerCase().trim() : '';
        d._birthYear = getYearFromDob(d.dob);
        if (d.Intake) d.Intake = (d.School ? d.School + ' - ' : '') + d.Intake;
        d._industry = d.industry ? d.industry.trim() : 'Chưa cập nhật';
        d._company = d.company ? d.company.trim() : 'Chưa cập nhật';
        d._title = groupTitle(d.title);
        d._gender = d.gender ? d.gender.toLowerCase() : 'unknown';

        let key = d._mailStr || d._phoneStr || d.name;
        if (!key) return;
        key = key.toLowerCase();

        if (!personMap[key]) {
            personMap[key] = {
                name: d.name,
                mail: d._mailStr,
                phone: d._phoneStr,
                gender: d._gender,
                birthYear: d._birthYear,
                schools: new Set(),
                intakes: new Set(),
                industries: new Set(),
                companies: new Set(),
                records: []
            };
        }
        if (d.School) personMap[key].schools.add(d.School);
        if (d.Intake) personMap[key].intakes.add(d.Intake);
        if (d.industry) personMap[key].industries.add(d.industry.trim());
        if (d.company) personMap[key].companies.add(d.company.trim());
        personMap[key].records.push(d);
    });

    uniquePeople = Object.values(personMap);
    multiSchoolPeople = uniquePeople.filter(p => p.schools.size > 1);
    
    // Sort multi-school by number of schools desc
    multiSchoolPeople.sort((a,b) => b.schools.size - a.schools.size);

    document.getElementById('header-total').textContent = `${uniquePeople.length.toLocaleString()} Alumni`;
    
    // Populate Global Dropdowns
    const selSchool = document.getElementById('global-school');
    const selIntake = document.getElementById('global-intake');
    
    const schools = [...new Set(rawAlumniData.map(d => d.School).filter(Boolean))].sort();
    const intakes = [...new Set(rawAlumniData.map(d => d.Intake).filter(Boolean))].sort();
    
    schools.forEach(s => selSchool.innerHTML += `<option value="${s}">${s}</option>`);
    intakes.forEach(i => selIntake.innerHTML += `<option value="${i}">${i}</option>`);

    selSchool.addEventListener('change', applyGlobalFilters);
    selIntake.addEventListener('change', applyGlobalFilters);

    initTabs();
    applyGlobalFilters(); // Trigger first render with full data
    initDirectory();
}

function applyGlobalFilters() {
    const sVal = document.getElementById('global-school').value;
    const iVal = document.getElementById('global-intake').value;

    currentFilteredData = rawAlumniData.filter(d => {
        if (sVal !== 'all' && d.School !== sVal) return false;
        if (iVal !== 'all' && d.Intake !== iVal) return false;
        return true;
    });

    let tempMap = {};
    currentFilteredData.forEach(d => {
        let key = d._mailStr || d._phoneStr || d.name;
        if (!key) return;
        key = key.toLowerCase();
        if (!tempMap[key]) {
            tempMap[key] = {
                name: d.name,
                mail: d._mailStr,
                phone: d._phoneStr,
                gender: d._gender,
                birthYear: d._birthYear,
                schools: new Set(),
                intakes: new Set(),
                industries: new Set(),
                companies: new Set(),
                records: []
            };
        }
        if (d.School) tempMap[key].schools.add(d.School);
        if (d.Intake) tempMap[key].intakes.add(d.Intake);
        if (d.industry) tempMap[key].industries.add(d.industry.trim());
        if (d.company) tempMap[key].companies.add(d.company.trim());
        tempMap[key].records.push(d);
    });
    currentFilteredUnique = Object.values(tempMap);

    document.getElementById('header-total').textContent = `${currentFilteredUnique.length.toLocaleString()} Alumni`;

    // Cascade Intake Dropdown logic
    const selIntake = document.getElementById('global-intake');
    const currentIntakeVal = selIntake.value;
    selIntake.innerHTML = '<option value="all">Tất cả Khóa</option>';
    let availableIntakes = [];
    if (sVal === 'all') {
        availableIntakes = [...new Set(rawAlumniData.map(d => d.Intake).filter(Boolean))].sort();
    } else {
        availableIntakes = [...new Set(rawAlumniData.filter(d => d.School === sVal).map(d => d.Intake).filter(Boolean))].sort();
    }
    availableIntakes.forEach(i => selIntake.innerHTML += `<option value="${i}">${i}</option>`);
    if (availableIntakes.includes(currentIntakeVal)) selIntake.value = currentIntakeVal;

    renderHeroStats();
    renderOverview();
    renderSchools();
    renderIntakes();
    renderIndustry();
    renderMultiSchool();
    
    // Ensure Directory respects the new global filtered data
    if (typeof applyDirectoryFilters === 'function') {
        applyDirectoryFilters();
    }
}

// --- TAB LOGIC ---
function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = document.getElementById(`tab-${btn.dataset.tab}`);
            if (target) target.classList.add('active');
        });
    });
}

// --- CHARTS & UI UTILS ---
const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#38bdf8', '#ec4899', '#22d3ee', '#a855f7', '#14b8a6'];
Chart.defaults.color = "#64748b";
Chart.defaults.font.family = "'Inter', sans-serif";

function getFreq(arr, keyProp) {
    let counts = {};
    arr.forEach(item => {
        let val = item[keyProp];
        if (val) {
            counts[val] = (counts[val] || 0) + 1;
        }
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]);
}

let chartInstances = {};
function createChart(id, config) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (chartInstances[id]) {
        chartInstances[id].destroy();
    }
    chartInstances[id] = new Chart(ctx, config);
    return chartInstances[id];
}

// --- RENDER FUNCTIONS ---
function renderHeroStats() {
    const schools = new Set();
    const intakes = new Set();
    currentFilteredData.forEach(d => {
        if (d.School) schools.add(d.School);
        if (d.Intake) intakes.add(d.Intake);
    });

    const grid = document.getElementById('kpi-cards');
    grid.innerHTML = `
        <div class="kpi-card" style="--accent: var(--primary); --accent-light: var(--primary-light)">
            <span class="kpi-icon"><i class='bx bx-group'></i></span>
            <div class="kpi-value">${currentFilteredUnique.length.toLocaleString()}</div>
            <div class="kpi-label">Tổng Cựu Sinh Viên</div>
            <div class="kpi-sub">Số lượng người học (Unique)</div>
        </div>
        <div class="kpi-card" style="--accent: var(--violet); --accent-light: var(--violet-light)">
            <span class="kpi-icon"><i class='bx bxs-school'></i></span>
            <div class="kpi-value">${schools.size.toLocaleString()}</div>
            <div class="kpi-label">Trường Đào Tạo</div>
            <div class="kpi-sub">Số lượng đối tác</div>
        </div>
        <div class="kpi-card" style="--accent: var(--emerald); --accent-light: var(--emerald-light)">
            <span class="kpi-icon"><i class='bx bx-calendar-event'></i></span>
            <div class="kpi-value">${intakes.size.toLocaleString()}</div>
            <div class="kpi-label">Tổng Khóa Học</div>
            <div class="kpi-sub">Các Intake đã tổ chức</div>
        </div>
        <div class="kpi-card" style="--accent: var(--amber); --accent-light: var(--amber-light)">
            <span class="kpi-icon"><i class='bx bxs-graduation'></i></span>
            <div class="kpi-value">${currentFilteredData.length.toLocaleString()}</div>
            <div class="kpi-label">Lượt Nhập Học</div>
            <div class="kpi-sub">Tổng số dòng dữ liệu</div>
        </div>
    `;
}

function renderOverview() {
    // School Pie
    const schoolFreq = getFreq(currentFilteredData, 'School');
    createChart('schoolPieChart', {
        type: 'pie',
        data: {
            labels: schoolFreq.map(x => x[0]),
            datasets: [{ data: schoolFreq.map(x => x[1]), backgroundColor: colors, borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // Gender Donut
    const genderFreq = getFreq(currentFilteredUnique, 'gender');
    createChart('genderDonut', {
        type: 'doughnut',
        data: {
            labels: genderFreq.map(x => x[0] === 'male' ? 'Nam' : (x[0] === 'female' ? 'Nữ' : 'Khác')),
            datasets: [{ data: genderFreq.map(x => x[1]), backgroundColor: ['#38bdf8', '#f43f5e', '#64748b'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
    });

    // Intake Bar (Top 20)
    const intakeFreq = getFreq(currentFilteredData, 'Intake').slice(0, 20);
    createChart('intakeBarChart', {
        type: 'bar',
        data: {
            labels: intakeFreq.map(x => x[0]),
            datasets: [{ label: 'Số alumni', data: intakeFreq.map(x => x[1]), backgroundColor: '#6366f1', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Birth Year
    const byFreq = getFreq(currentFilteredUnique, 'birthYear').filter(x => x[0] !== 'Unknown').slice(0, 15);
    // Sort chronologically
    byFreq.sort((a,b) => parseInt(a[0]) - parseInt(b[0]));
    createChart('birthYearChart', {
        type: 'line',
        data: {
            labels: byFreq.map(x => x[0]),
            datasets: [{ label: 'Số lượng', data: byFreq.map(x => x[1]), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    
    // Generations Chart
    let genZ = 0, genY = 0, genX = 0, boomer = 0;
    currentFilteredUnique.forEach(p => {
        let y = parseInt(p.birthYear);
        if (!y || isNaN(y)) return;
        if (y >= 1997 && y <= 2012) genZ++;
        else if (y >= 1981 && y <= 1996) genY++;
        else if (y >= 1965 && y <= 1980) genX++;
        else if (y < 1965) boomer++;
    });
    createChart('generationChart', {
        type: 'doughnut',
        data: {
            labels: ['Gen Z (1997-2012)', 'Millennials / Gen Y (1981-1996)', 'Gen X (1965-1980)', 'Boomers (<1965)'],
            datasets: [{ data: [genZ, genY, genX, boomer], backgroundColor: ['#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } }
    });

}

function renderSchools() {
    const schoolStats = {};
    currentFilteredData.forEach(d => {
        const s = d.School;
        if (!s) return;
        if (!schoolStats[s]) schoolStats[s] = { total: 0, male: 0, female: 0, industries: {} };
        schoolStats[s].total++;
        if (d.gender === 'male') schoolStats[s].male++;
        if (d.gender === 'female') schoolStats[s].female++;
        if (d.industry) {
            schoolStats[s].industries[d.industry] = (schoolStats[s].industries[d.industry] || 0) + 1;
        }
    });

    const sList = Object.entries(schoolStats).sort((a,b) => b[1].total - a[1].total);
    
    // Render Cards
    const grid = document.getElementById('school-cards-grid');
    grid.innerHTML = sList.map((item, idx) => {
        const name = item[0];
        const stat = item[1];
        const color = colors[idx % colors.length];
        
        let topInd = Object.entries(stat.industries).sort((a,b) => b[1]-a[1])[0];
        topInd = topInd ? topInd[0] : 'N/A';

        const malePct = stat.total > 0 ? (stat.male / stat.total * 100) : 0;

        return `
            <div class="school-stat-card" style="background: linear-gradient(135deg, ${color}20, ${color}05); border-color: ${color}40;">
                <div class="scard-name" style="color: ${color}">${name}</div>
                <div class="scard-full">ĐỐI TÁC / TRƯỜNG</div>
                <div class="scard-count">${stat.total.toLocaleString()}</div>
                <div class="scard-label" style="margin-top: 8px;">Alumni</div>
                <div class="scard-bar">
                    <div class="scard-bar-fill" style="width: ${malePct}%; background: ${color}"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px; opacity: 0.8">
                    <span>Nam: ${Math.round(malePct)}%</span>
                    <span>Nữ: ${Math.round(100 - malePct)}%</span>
                </div>
            </div>
        `;
    }).join('');

    // Render Chart
    createChart('schoolBarChart', {
        type: 'bar',
        data: {
            labels: sList.map(x => x[0]),
            datasets: [
                { label: 'Nam', data: sList.map(x => x[1].male), backgroundColor: '#38bdf8' },
                { label: 'Nữ', data: sList.map(x => x[1].female), backgroundColor: '#f43f5e' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });
}

function renderIntakes() {
    const intakeFreq = getFreq(currentFilteredData, 'Intake');
    document.getElementById('intake-total-badge').textContent = `${intakeFreq.length} Khóa học`;

    createChart('allIntakeChart', {
        type: 'bar',
        data: {
            labels: intakeFreq.map(x => x[0]),
            datasets: [{ label: 'Số alumni', data: intakeFreq.map(x => x[1]), backgroundColor: '#8b5cf6', borderRadius: 2 }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false } }
        }
    });
}

function renderIndustry() {
    const indFreq = getFreq(currentFilteredData, 'industry').filter(x => x[0] !== 'Chưa cập nhật').slice(0, 15);
    createChart('industryChart', {
        type: 'bar',
        data: {
            labels: indFreq.map(x => x[0]),
            datasets: [{ label: 'Số lượng', data: indFreq.map(x => x[1]), backgroundColor: '#10b981', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const comFreq = getFreq(currentFilteredData, 'company').filter(x => x[0] !== 'Chưa cập nhật').slice(0, 10);
    createChart('companyChart', {
        type: 'bar',
        data: {
            labels: comFreq.map(x => x[0]),
            datasets: [{ label: 'Alumni', data: comFreq.map(x => x[1]), backgroundColor: '#f59e0b', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const titleFreq = getFreq(currentFilteredData, '_title').filter(x => x[0] !== 'Chưa cập nhật').slice(0, 10);
    createChart('titleChart', {
        type: 'bar',
        data: {
            labels: titleFreq.map(x => x[0]),
            datasets: [{ label: 'Alumni', data: titleFreq.map(x => x[1]), backgroundColor: '#ec4899', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    
    // Cross Analysis C-Level vs Industry
    const clevels = currentFilteredData.filter(d => d._title.includes('Giám đốc') || d._title.includes('C-Level'));
    const crossFreq = getFreq(clevels, 'industry').filter(x => x[0] !== 'Chưa cập nhật').slice(0, 10);
    createChart('crossClevelChart', {
        type: 'bar',
        data: {
            labels: crossFreq.map(x => x[0]),
            datasets: [{ label: 'Số lượng C-Level', data: crossFreq.map(x => x[1]), backgroundColor: '#8b5cf6', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderMultiSchool() {
    const currentMultiSchool = currentFilteredUnique.filter(p => p.intakes.size > 1);
    currentMultiSchool.sort((a,b) => b.intakes.size - a.intakes.size);

    document.getElementById('multi-count-badge').textContent = currentMultiSchool.length;
    
    const tbody = document.getElementById('multi-tbody');
    const searchInput = document.getElementById('multi-search');

    function renderTable(data) {
        tbody.innerHTML = data.map((p, i) => {
            const schTags = Array.from(p.intakes).map(s => `<span class="school-tag badge-school">${s}</span>`).join('');
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td style="font-weight: 600; color: var(--text-0)">${p.name}</td>
                    <td><div class="school-tags">${schTags}</div></td>
                    <td style="text-align: center; font-weight: bold; color: var(--primary)">${p.intakes.size}</td>
                    <td class="masked">${maskEmail(p.mail)}</td>
                    <td class="masked">${maskPhone(p.phone)}</td>
                </tr>
            `;
        }).join('');
    }

    renderTable(currentMultiSchool);

    // Remove old event listener and add new one to prevent accumulation
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = currentMultiSchool.filter(p => 
            p.name.toLowerCase().includes(val) || 
            p.mail.includes(val) || 
            p.phone.includes(val) ||
            Array.from(p.intakes).some(s => s.toLowerCase().includes(val))
        );
        renderTable(filtered);
    });
}

// --- DIRECTORY ---
function initDirectory() {
    const selSchool = document.getElementById('filter-school');
    const selGender = document.getElementById('filter-gender');
    const selIndustry = document.getElementById('filter-industry');
    const searchInput = document.getElementById('dir-search');

    // Populate selects
    const schools = [...new Set(rawAlumniData.map(d => d.School).filter(Boolean))].sort();
    schools.forEach(s => selSchool.innerHTML += `<option value="${s}">${s}</option>`);

    const industries = [...new Set(rawAlumniData.map(d => d.industry).filter(Boolean))].sort();
    industries.forEach(i => selIndustry.innerHTML += `<option value="${i}">${i}</option>`);

    selSchool.addEventListener('change', applyDirectoryFilters);
    selGender.addEventListener('change', applyDirectoryFilters);
    selIndustry.addEventListener('change', applyDirectoryFilters);
    searchInput.addEventListener('input', applyDirectoryFilters);
}

function applyDirectoryFilters() {
    const selSchool = document.getElementById('filter-school');
    const selGender = document.getElementById('filter-gender');
    const selIndustry = document.getElementById('filter-industry');
    const searchInput = document.getElementById('dir-search');
    
    if (!selSchool || !selGender || !selIndustry || !searchInput) return;

    const sVal = selSchool.value;
    const gVal = selGender.value;
    const iVal = selIndustry.value;
    const qVal = searchInput.value.toLowerCase();

    dirFilteredData = currentFilteredData.filter(d => {
        if (sVal && d.School !== sVal) return false;
        if (gVal && d._gender !== gVal) return false;
        if (iVal && d.industry !== iVal) return false;
        if (qVal) {
            if (!d.name.toLowerCase().includes(qVal) && 
                !d._mailStr.includes(qVal) && 
                !d._phoneStr.includes(qVal)) {
                return false;
            }
        }
        return true;
    });

    dirCurrentPage = 1;
    renderDirTable();
}

function renderDirTable() {
    document.getElementById('dir-count-badge').textContent = dirFilteredData.length.toLocaleString();
    
    const totalPages = Math.ceil(dirFilteredData.length / PAGE_SIZE);
    const start = (dirCurrentPage - 1) * PAGE_SIZE;
    const paginated = dirFilteredData.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('dir-tbody');
    tbody.innerHTML = paginated.map((d, i) => {
        const genderBadge = d._gender === 'male' ? '<span class="badge badge-male">Nam</span>' : 
                           (d._gender === 'female' ? '<span class="badge badge-female">Nữ</span>' : '<span class="badge" style="background:#333">Khác</span>');
        
        return `
            <tr>
                <td>${start + i + 1}</td>
                <td style="font-weight: 500">${d.name}</td>
                <td>${genderBadge}</td>
                <td><span class="badge badge-school">${d.School || ''}</span></td>
                <td>${d.Intake || ''}</td>
                <td>${d._birthYear}</td>
                <td class="masked">${maskEmail(d._mailStr)}</td>
                <td class="masked">${maskPhone(d._phoneStr)}</td>
                <td>${d._industry !== 'Chưa cập nhật' ? `<span class="tag-industry">${d._industry}</span>` : ''}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d._company}">${d._company !== 'Chưa cập nhật' ? d._company : ''}</td>
            </tr>
        `;
    }).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pag = document.getElementById('pagination');
    if (totalPages <= 1) {
        pag.innerHTML = '';
        return;
    }

    let html = '';
    
    // Prev
    if (dirCurrentPage > 1) {
        html += `<button class="page-btn" data-page="${dirCurrentPage - 1}">«</button>`;
    }

    // Pages (simple logic for now)
    let startP = Math.max(1, dirCurrentPage - 2);
    let endP = Math.min(totalPages, dirCurrentPage + 2);

    for (let i = startP; i <= endP; i++) {
        html += `<button class="page-btn ${i === dirCurrentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    // Next
    if (dirCurrentPage < totalPages) {
        html += `<button class="page-btn" data-page="${dirCurrentPage + 1}">»</button>`;
    }

    pag.innerHTML = html;

    pag.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            dirCurrentPage = parseInt(btn.dataset.page);
            renderDirTable();
        });
    });
}
