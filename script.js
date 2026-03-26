let allRepos = [];
let projectConfig = { repos: [] };
let currentSort = 'pushed_at';

async function init() {
    const status = document.getElementById('status');
    try {
        const configResponse = await fetch('projects.json');
        if (!configResponse.ok) throw new Error("Missing projects.json");
        
        projectConfig = await configResponse.json();
        const targetPaths = projectConfig.repos.map(r => r.path.toLowerCase());

        let page = 1;
        let keepFetching = true;
        let collected = [];

        status.innerText = "Syncing with GitHub...";

        while (keepFetching) {
            const res = await fetch(`https://api.github.com/users/a8kj7sea/repos?per_page=100&page=${page}`);
            if (!res.ok) {
                if(res.status === 403) throw new Error("Rate limit exceeded");
                break;
            }
            
            const data = await res.json();
            if (data.length === 0 || page > 5) {
                keepFetching = false;
            } else {
                collected = collected.concat(data);
                page++;
            }
        }

        allRepos = collected.filter(repo => targetPaths.includes(repo.full_name.toLowerCase()));
        status.innerText = `System Online: ${allRepos.length} items loaded`;
        filterAndRender();
    } catch (e) {
        status.innerText = `Error: ${e.message}`;
        console.error(e);
    }
}

function setSort(key) {
    currentSort = key;
    document.getElementById('sortControl').value = key;
    filterAndRender();
}

function filterAndRender() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sortKey = document.getElementById('sortControl').value;

    let filtered = allRepos.filter(r => 
        r.name.toLowerCase().includes(searchTerm) || 
        (r.description && r.description.toLowerCase().includes(searchTerm))
    );

    filtered.sort((a, b) => {
        const aFeat = projectConfig.repos.find(ref => ref.path.toLowerCase() === a.full_name.toLowerCase())?.featured;
        const bFeat = projectConfig.repos.find(ref => ref.path.toLowerCase() === b.full_name.toLowerCase())?.featured;

        if (aFeat && !bFeat) return -1;
        if (!aFeat && bFeat) return 1;

        if (sortKey === 'pushed_at') return new Date(b.pushed_at) - new Date(a.pushed_at);
        return (a[sortKey] || "").toString().localeCompare((b[sortKey] || "").toString());
    });

    const body = document.getElementById('repoBody');
    body.innerHTML = filtered.map(repo => {
        const isFeatured = projectConfig.repos.find(ref => ref.path.toLowerCase() === repo.full_name.toLowerCase())?.featured;
        return `
            <tr class="${isFeatured ? 'featured-row' : ''}">
                <td>
                    <div class="repo-name" onclick="showDetails('${repo.full_name}')">
                        <span class="folder-icon ${isFeatured ? 'star' : ''}">${isFeatured ? '📁' : '📁'}</span> 
                        ${repo.name}/
                        ${isFeatured ? '<span class="featured-badge">FEATURED</span>' : ''}
                    </div>
                </td>
                <td style="color: var(--muted); font-size: 12px;">${repo.description || '---'}</td>
                <td><span class="lang-dot" style="background: ${getLangColor(repo.language)}"></span>${repo.language || 'Data'}</td>
                <td>${(repo.topics || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('')}</td>
                <td style="color: var(--muted)">${new Date(repo.pushed_at).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');
}

async function showDetails(fullName) {
    const repo = allRepos.find(r => r.full_name === fullName);
    if (!repo) return;

    document.getElementById('det-name').innerText = repo.name;
    document.getElementById('det-desc').innerText = repo.description || "No description provided.";
    document.getElementById('det-link').href = repo.html_url;
    document.getElementById('details-panel').classList.add('open');
    
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = "<div style='color:var(--accent); font-size:11px;'>SCANNING DIRECTORY...</div>";

    try {
        const files = await fetch(`https://api.github.com/repos/${fullName}/contents`).then(res => res.json());
        if (Array.isArray(files)) {
            fileList.innerHTML = files.slice(0, 15).map(f => `<div class="file-item">${f.name}</div>`).join('');
        } else {
            fileList.innerHTML = "<div class='file-item'>Empty or restricted.</div>";
        }
    } catch (e) {
        fileList.innerHTML = "<div style='color:var(--muted)'>Access Denied.</div>";
    }
}

function closeSidebar() {
    document.getElementById('details-panel').classList.remove('open');
}

function getLangColor(l) { 
    const c = {
        'Java':'#b07219',
        'Python':'#3572A5',
        'JavaScript':'#f1e05a',
        'C++':'#f34b7d',
        'C':'#555555',
        'HTML':'#e34c26',
        'TypeScript':'#3178c6',
        'CSS':'#563d7c'
    }; 
    return c[l] || '#8b949e'; 
}

window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeSidebar();
});

init();