const { ipcRenderer } = require('electron');

let newsData = [];
let currentHeroIndex = 0;

async function loadNews() {
    const heroTitle = document.getElementById('heroTitle');
    const newsCarousel = document.getElementById('newsCarousel');
    const navDots = document.getElementById('navDots');
    const heroReadMore = document.getElementById('heroReadMore');

    try {
        newsData = await ipcRenderer.invoke('get-news');

        if (!newsData || newsData.length === 0) {
            heroTitle.textContent = 'Sem notícias disponíveis';
            newsCarousel.innerHTML = '<p style="color: rgba(255,255,255,0.4);">Nenhuma notícia encontrada.</p>';
            return;
        }

        updateHero(0);

        newsCarousel.innerHTML = '';
        newsData.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'news-card' + (idx === 0 ? ' active' : '');
            card.dataset.index = idx;

            const bgImage = item.image || 'https://hytale.com/static/images/media/screenshots/1.jpg';

            card.innerHTML = `
                <div class="news-card-image" style="background-image: url('${bgImage}')"></div>
                <div class="news-card-content">
                    <p class="news-card-title">${item.title}</p>
                </div>
            `;

            card.addEventListener('click', () => {
                updateHero(idx);
                document.querySelectorAll('.news-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                updateNavDots(idx);
            });

            newsCarousel.appendChild(card);
        });

        if (navDots) {
            navDots.innerHTML = '';
            newsData.forEach((_, idx) => {
                const dot = document.createElement('div');
                dot.className = 'nav-dot' + (idx === 0 ? ' active' : '');
                dot.addEventListener('click', () => {
                    updateHero(idx);
                    document.querySelectorAll('.news-card').forEach(c => c.classList.remove('active'));
                    const cards = document.querySelectorAll('.news-card');
                    if (cards[idx]) cards[idx].classList.add('active');
                    updateNavDots(idx);
                });
                navDots.appendChild(dot);
            });
        }

        if (heroReadMore) {
            heroReadMore.addEventListener('click', (e) => {
                e.stopPropagation();
                if (newsData[currentHeroIndex]?.link) {
                    require('electron').shell.openExternal(newsData[currentHeroIndex].link);
                }
            });
        }

        // Auto-slide a cada 6 segundos
        if (newsData.length > 1) {
            setInterval(() => {
                const nextIndex = (currentHeroIndex + 1) % newsData.length;
                updateHero(nextIndex);
                document.querySelectorAll('.news-card').forEach(c => c.classList.remove('active'));
                const cards = document.querySelectorAll('.news-card');
                if (cards[nextIndex]) cards[nextIndex].classList.add('active');
                updateNavDots(nextIndex);
            }, 6000);
        }

    } catch (e) {
        console.error("News Load Error:", e);
        heroTitle.textContent = 'Erro ao carregar notícias';
        newsCarousel.innerHTML = '<p style="color: #ff4444;">Falha ao carregar.</p>';
    }
}

function updateNavDots(index) {
    const dots = document.querySelectorAll('.nav-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function updateHero(index) {
    currentHeroIndex = index;
    const item = newsData[index];
    if (!item) return;

    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');

    heroTitle.textContent = item.title;
    heroDescription.textContent = item.summary || 'Sua aventura começa aqui';
}

module.exports = {
    loadNews,
    updateHero,
    updateNavDots
};
