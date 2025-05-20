document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    const modal = document.getElementById('geneModal');
    const closeBtn = document.querySelector('.close');
    let abortController = null;

    // 实时搜索功能
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();

        // 取消之前的请求
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();

        if (query.length === 0) {
            resultsDiv.innerHTML = '<div class="empty">输入基因名或功能开始搜索</div>';
            return;
        }

        // 显示加载状态
        resultsDiv.innerHTML = '<div class="loading">🔍 搜索中...</div>';

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: query }),
                signal: abortController.signal
            });

            if (!response.ok) throw new Error(`HTTP错误! 状态码: ${response.status}`);

            const data = await response.json();

            if (data.error) {
                resultsDiv.innerHTML = `<div class="error">⚠️ ${data.error}</div>`;
                return;
            }

            renderResults(data.results);

        } catch (error) {
            if (error.name !== 'AbortError') {
                resultsDiv.innerHTML = `<div class="error">⚠️ 搜索失败: ${error.message}</div>`;
            }
        }
    });

    // 渲染搜索结果
    function renderResults(results) {
        resultsDiv.innerHTML = results.length === 0
            ? '<div class="empty">😞 未找到匹配结果</div>'
            : results.map(gene => `
                <div class="gene-card" data-name="${gene.name}">
                    <div class="gene-header">
                        <span class="verified-badge ${gene.verified ? 'yes' : ''}">
                            ${gene.verified ? '✅ 已验证' : '⏳ 待验证'}
                        </span>
                        <h3>${gene.name}</h3>
                    </div>
                    ${gene.functions ? `
                    <div class="functions">
                        ${gene.functions.split('; ')
                            .map(func => `<span class="func-tag">${func.trim()}</span>`)
                            .join('')}
                    </div>` : ''}
                </div>
            `).join('');
    }

    // 点击基因卡片显示详情（事件委托）
    resultsDiv.addEventListener('click', async (e) => {
        const card = e.target.closest('.gene-card');
        if (!card) return;

        const geneName = card.dataset.name;
        try {
            const response = await fetch(`/api/gene/${geneName}`);
            if (!response.ok) throw new Error('详情加载失败');

            const data = await response.json();

            // 填充弹窗内容
            document.getElementById('modalGeneName').textContent = data.name;
            document.getElementById('modalVerified').textContent =
                data.verified ? '已验证' : '待验证';
            document.getElementById('modalVerified').className =
                `verified-badge ${data.verified ? 'yes' : ''}`;
            document.getElementById('modalDescription').textContent = data.description;
            document.getElementById('modalDate').textContent =
                new Date(data.created_at).toLocaleDateString();

            // 显示弹窗
            modal.style.display = 'block';

        } catch (error) {
            alert(`无法加载详情: ${error.message}`);
        }
    });

    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // 点击外部关闭弹窗
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});