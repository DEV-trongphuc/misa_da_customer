const fs = require('fs');
let css = fs.readFileSync('alumni_style.css', 'utf8');

css = css.replace(/--bg-0: #08090f;/g, '--bg-0: #f1f5f9;');
css = css.replace(/--bg-1: #0f1117;/g, '--bg-1: #f8fafc;');
css = css.replace(/--bg-2: #161820;/g, '--bg-2: #ffffff;');
css = css.replace(/--bg-3: #1e2030;/g, '--bg-3: #e2e8f0;');

css = css.replace(/--bg-glass: rgba\(255,255,255,0\.04\);/g, '--bg-glass: rgba(255,255,255,0.6);');
css = css.replace(/--bg-glass2: rgba\(255,255,255,0\.07\);/g, '--bg-glass2: rgba(255,255,255,0.9);');

css = css.replace(/--border: rgba\(255,255,255,0\.08\);/g, '--border: rgba(0,0,0,0.06);');
css = css.replace(/--border2: rgba\(255,255,255,0\.12\);/g, '--border2: rgba(0,0,0,0.12);');

css = css.replace(/--text-0: #ffffff;/g, '--text-0: #0f172a;');
css = css.replace(/--text-1: #e2e8f0;/g, '--text-1: #1e293b;');
css = css.replace(/--text-2: #94a3b8;/g, '--text-2: #475569;');
css = css.replace(/--text-3: #64748b;/g, '--text-3: #64748b;');

css = css.replace(/--shadow-sm: 0 1px 3px rgba\(0,0,0,\.4\);/g, '--shadow-sm: 0 1px 3px rgba(0,0,0,.05);');
css = css.replace(/--shadow: 0 4px 24px rgba\(0,0,0,\.5\);/g, '--shadow: 0 4px 24px rgba(0,0,0,.05);');
css = css.replace(/--shadow-lg: 0 16px 48px rgba\(0,0,0,\.6\);/g, '--shadow-lg: 0 16px 48px rgba(0,0,0,.08);');

css = css.replace(/rgba\(8,9,15,0\.85\)/g, 'rgba(255,255,255,0.85)');

css = css.replace(/rgba\(255,255,255,\.04\)/g, 'rgba(0,0,0,.04)');
css = css.replace(/rgba\(255,255,255,\.2\)/g, 'rgba(0,0,0,.15)');
css = css.replace(/rgba\(255,255,255,\.7\)/g, 'rgba(0,0,0,.4)');
css = css.replace(/color: #fff/g, 'color: #ffffff');

fs.writeFileSync('alumni_style.css', css, 'utf8');

let js = fs.readFileSync('alumni_app.js', 'utf8');
js = js.replace(/Chart\.defaults\.color = '#94a3b8';/g, 'Chart.defaults.color = "#64748b";');
js = js.replace(/color: #fff/g, 'color: var(--text-0)');
fs.writeFileSync('alumni_app.js', js, 'utf8');

console.log('Done');
