(function() {
    // ========== DATA ==========
    const TICKETS_DATA = window.TICKETS_DATA || [];

    // ========== STATE ==========
    let currentTicketIndex = 0;
    let correctOnly = false;
    let searchQuery = '';
    let isDarkTheme = false;

    // Новые переменные для теста
    let testMode = false;
    let testTicketIndex = 0;          // индекс билета в TICKETS_DATA
    let testQuestionIndex = 0;        // индекс вопроса в билете
    let testAnswers = [];             // массив ответов: null или {selected: Number, correct: Boolean}

    // ========== DOM REFS ==========
    const $ = (s) => document.querySelector(s);
    const searchWrapper = document.getElementById('searchWrapper');
    const searchInput = $('#searchInput');
    const searchDropdown = $('#searchDropdown');
    const searchBadge = $('#searchBadge');
    const resetSearchBtn = $('#resetSearchBtn');
    const ticketSelect = $('#ticketSelect');
    const ticketPagination = $('#ticketPagination');
    const ticketTitle = $('#ticketTitle');
    const questionCount = $('#questionCount');
    const questionsList = $('#questionsList');
    const emptyState = $('#emptyState');
    const themeToggle = $('#themeToggle');
    const correctOnlyToggle = $('#correctOnlyToggle');
    const testModeToggle = $('#testModeToggle');
    const testControlsTop = $('#testControlsTop');
    const testControlsBottom = $('#testControlsBottom');
    // const testControls = $('#testControls');
    const testResults = $('#testResults');
    const prevQuestionBtn = $('#prevQuestionBtn');
    const nextQuestionBtn = $('#nextQuestionBtn');
    const finishTestBtn = $('#finishTestBtn');
    const finishTestBtnBottom = $('#finishTestBtnBottom');  // новая
    const nextTicketBtn = $('#nextTicketBtn');
    const questionProgress = $('#questionProgress');

    // ========== UTILS ==========
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function highlightText(text, query) {
        if (!query || query.trim().length < 2) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return text.replace(regex, '<span class="highlight-match">$1</span>');
    }

    function performGlobalSearch(query) {
        if (query.length < 2) return [];
        const lower = query.toLowerCase();
        const results = [];
        TICKETS_DATA.forEach((ticket, tIdx) => {
            ticket.questions.forEach((q, qIdx) => {
                if (q.text.toLowerCase().includes(lower)) {
                    results.push({
                        ticketIndex: tIdx,
                        ticketId: ticket.id,
                        questionIndex: qIdx,
                        text: q.text,
                        matchType: 'question'
                    });
                } else {
                    for (let opt of q.options) {
                        if (opt.text.toLowerCase().includes(lower)) {
                            results.push({
                                ticketIndex: tIdx,
                                ticketId: ticket.id,
                                questionIndex: qIdx,
                                text: q.text,
                                matchType: 'option'
                            });
                            break;
                        }
                    }
                }
            });
        });
        return results.slice(0, 20);
    }

    function showDropdown(results) {
        if (!results.length) {
            searchDropdown.style.display = 'none';
            return;
        }
        searchDropdown.innerHTML = results.map(r => `
            <div class="dropdown-item" data-ticket-index="${r.ticketIndex}" data-question-index="${r.questionIndex}">
                <span class="dropdown-badge">Б.${r.ticketId} В.${r.questionIndex+1}</span>
                <span class="dropdown-text">${escapeHTML(r.text.substring(0, 80))}${r.text.length>80?'…':''}</span>
            </div>
        `).join('');
        searchDropdown.style.display = 'block';
    }

    function hideDropdown() {
        searchDropdown.style.display = 'none';
    }

    // ========== RENDER (обычный режим) ==========
    function renderQuestionCard(q, index, highlightTerm) {
        const showAll = !correctOnly;
        const card = document.createElement('div');
        card.className = 'question-card';
        card.setAttribute('data-question-index', index);

        const numLabel = `ВОПРОС ${index + 1} / 10`;
        const qText = highlightTerm.length >= 2 ? highlightText(q.text, highlightTerm) : q.text;

        card.innerHTML = `
            <div class="q-number">${numLabel}</div>
            <div class="q-text">${qText}</div>
            <ul class="options-list">
                ${q.options.map((opt, oi) => {
                    const optText = highlightTerm.length >= 2 ? highlightText(opt.text, highlightTerm) : opt.text;
                    const isCorrect = opt.correct;
                    let cls = 'option-item';
                    if (isCorrect) cls += ' correct';
                    if (!isCorrect && !showAll) cls += ' hidden-wrong';
                    const marker = isCorrect ? '✓' : '';
                    return `
                        <li class="${cls}">
                            <span class="option-marker">${marker}</span>
                            <span>${optText}</span>
                        </li>`;
                }).join('')}
            </ul>
        `;
        return card;
    }

    function renderTicket(ticketIndex, highlightTerm = '') {
        if (ticketIndex < 0 || ticketIndex >= TICKETS_DATA.length) return;
        currentTicketIndex = ticketIndex;

        const ticket = TICKETS_DATA[ticketIndex];
        ticketTitle.textContent = `№ ${ticket.id}`;
        questionCount.textContent = `${ticket.questions.length} вопросов`;

        ticketSelect.value = ticketIndex;

        questionsList.innerHTML = '';
        emptyState.style.display = 'none';
        questionsList.style.display = '';
        testResults.style.display = 'none';

        ticket.questions.forEach((q, i) => {
            const card = renderQuestionCard(q, i, highlightTerm);
            questionsList.appendChild(card);
        });

        renderPagination(ticketIndex);
        updateSearchBadge();
    }

    function renderPagination(activeIndex) {
        const total = TICKETS_DATA.length;
        let start = Math.max(0, activeIndex - 2);
        let end = Math.min(total - 1, activeIndex + 2);
        if (end - start < 4) {
            if (start === 0) end = Math.min(total - 1, start + 4);
            else if (end === total - 1) start = Math.max(0, end - 4);
        }
        const visiblePages = [];
        for (let i = start; i <= end; i++) visiblePages.push(i);

        ticketPagination.innerHTML = '';

        // Prev
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '←';
        prevBtn.disabled = activeIndex === 0;
        prevBtn.addEventListener('click', () => navigateToTicket(activeIndex - 1));
        ticketPagination.appendChild(prevBtn);

        // First + ellipsis
        if (visiblePages[0] > 0) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'page-btn';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => navigateToTicket(0));
            ticketPagination.appendChild(firstBtn);
            if (visiblePages[0] > 1) {
                const dots = document.createElement('span');
                dots.textContent = '…';
                dots.style.cssText = 'padding:0 4px;color:var(--text-secondary);font-size:0.8rem;';
                ticketPagination.appendChild(dots);
            }
        }

        visiblePages.forEach(i => {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (i === activeIndex ? ' active' : '');
            btn.textContent = i + 1;
            btn.addEventListener('click', () => navigateToTicket(i));
            ticketPagination.appendChild(btn);
        });

        if (visiblePages[visiblePages.length-1] < total - 1) {
            if (visiblePages[visiblePages.length-1] < total - 2) {
                const dots = document.createElement('span');
                dots.textContent = '…';
                dots.style.cssText = 'padding:0 4px;color:var(--text-secondary);font-size:0.8rem;';
                ticketPagination.appendChild(dots);
            }
            const lastBtn = document.createElement('button');
            lastBtn.className = 'page-btn';
            lastBtn.textContent = total;
            lastBtn.addEventListener('click', () => navigateToTicket(total - 1));
            ticketPagination.appendChild(lastBtn);
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '→';
        nextBtn.disabled = activeIndex === total - 1;
        nextBtn.addEventListener('click', () => navigateToTicket(activeIndex + 1));
        ticketPagination.appendChild(nextBtn);
    }

    function navigateToTicket(index, searchTerm = '') {
        if (index < 0 || index >= TICKETS_DATA.length) return;
        currentTicketIndex = index;
        searchInput.value = searchTerm;
        searchQuery = searchTerm;
        resetSearchBtn.style.display = searchTerm.length >= 2 ? '' : 'none';
        hideDropdown();
        renderTicket(index, searchTerm);
        window.location.hash = `ticket-${TICKETS_DATA[index].id}`;
        ticketTitle.classList.remove('pulse-anim');
        void ticketTitle.offsetWidth;
        ticketTitle.classList.add('pulse-anim');
    }

    function updateSearchBadge() {
        if (searchQuery.length >= 2) {
            searchBadge.style.display = 'inline';
            searchBadge.textContent = `«${searchQuery}»`;
        } else {
            searchBadge.style.display = 'none';
        }
    }

    function populateTicketSelect() {
        ticketSelect.innerHTML = '';
        TICKETS_DATA.forEach((ticket, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `№ ${ticket.id}`;
            ticketSelect.appendChild(opt);
        });
        ticketSelect.addEventListener('change', () => {
            const idx = parseInt(ticketSelect.value);
            if (testMode) {
                startTest(idx);
            } else {
                navigateToTicket(idx, searchQuery);
            }
        });
    }

    // ========== РЕЖИМ ТЕСТА ==========
    function toggleTestMode(enable) {
        testMode = enable;
        if (enable) {
            // Всегда начинаем новый тест при включении переключателя
            const randomIdx = Math.floor(Math.random() * TICKETS_DATA.length);
            startTest(randomIdx);
            const correctOnlyGroup = correctOnlyToggle.closest('.toggle-group');
            if (correctOnlyGroup) correctOnlyGroup.style.display = 'none';
        } else {
            // Возврат к обычному режиму просмотра
            // testControls.style.display = 'none';
            testControlsTop.style.display = 'none';
            testControlsBottom.style.display = 'none';
            testResults.style.display = 'none';
            questionsList.style.display = '';
            ticketPagination.style.display = '';
            correctOnlyToggle.disabled = false;
            const correctOnlyGroup = correctOnlyToggle.closest('.toggle-group');
            if (correctOnlyGroup) correctOnlyGroup.style.display = '';
            renderTicket(currentTicketIndex, searchQuery);
        }
    }

    function startTest(ticketIndex) {
        testTicketIndex = ticketIndex;
        testQuestionIndex = 0;
        testAnswers = new Array(TICKETS_DATA[ticketIndex].questions.length).fill(null);
        ticketSelect.value = ticketIndex;

        // Настройка интерфейса для теста
        // testControls.style.display = 'flex';
        testControlsTop.style.display = 'flex';
        testControlsBottom.style.display = 'flex';
        testResults.style.display = 'none';
        ticketPagination.style.display = 'none';
        questionsList.style.display = '';
        correctOnlyToggle.disabled = true;

        const ticket = TICKETS_DATA[testTicketIndex];
        ticketTitle.textContent = `Билет ${ticket.id} (тест)`;
        questionCount.textContent = `${ticket.questions.length} вопросов`;

        renderTestQuestion();
    }

    // Удалите функцию switchToTestView() если она осталась – она больше не нужна

    function renderTestQuestion() {
        const ticket = TICKETS_DATA[testTicketIndex];
        const q = ticket.questions[testQuestionIndex];
        const userAnswer = testAnswers[testQuestionIndex];

        questionsList.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'question-card test-card';
        card.setAttribute('data-question-index', testQuestionIndex);

        const numLabel = `ВОПРОС ${testQuestionIndex + 1} / ${ticket.questions.length}`;
        card.innerHTML = `
            <div class="q-number">${numLabel}</div>
            <div class="q-text">${q.text}</div>
            <ul class="options-list">
                ${q.options.map((opt, oi) => {
                    let cls = 'option-item';
                    let marker = '';
                    // Определяем состояние подсветки
                    if (userAnswer) {
                        if (opt.correct) {
                            cls += ' correct';
                            marker = '✓';
                        } else if (userAnswer.selected === oi) {
                            cls += ' wrong';
                            marker = '✗';
                        }
                    }
                    // data-атрибут для обработки клика
                    return `
                        <li class="${cls}" data-option-index="${oi}">
                            <span class="option-marker">${marker}</span>
                            <span>${opt.text}</span>
                        </li>`;
                }).join('')}
            </ul>
        `;

        questionsList.appendChild(card);

        // Обновляем прогресс
        questionProgress.textContent = `${testQuestionIndex + 1} вопрос из ${ticket.questions.length}`;

        // Управление кнопками
        prevQuestionBtn.disabled = testQuestionIndex === 0;
        nextQuestionBtn.disabled = testQuestionIndex === ticket.questions.length - 1;

        // Верхняя панель: показываем «Завершить» только после первого ответа
        const anyAnswered = testAnswers.some(a => a !== null);
        finishTestBtn.style.display = anyAnswered ? 'inline-flex' : 'none';
        // Когда «Завершить» скрыт, прогресс тоже прячем, а кнопка «Случайный билет» растягивается
        questionProgress.style.display = anyAnswered ? '' : 'none';
        // Настройка растяжения кнопки «Случайный билет» делается через CSS-класс
        testControlsTop.classList.toggle('single-btn', !anyAnswered);

        // Нижняя кнопка «Завершить» вместо «Следующий вопрос» на последнем вопросе при всех ответах
        const isLast = testQuestionIndex === ticket.questions.length - 1;
        const allAnswered = testAnswers.every(a => a !== null);

        if (isLast && allAnswered) {
            nextQuestionBtn.style.display = 'none';
            finishTestBtnBottom.style.display = 'inline-flex';
        } else {
            nextQuestionBtn.style.display = 'inline-flex';
            finishTestBtnBottom.style.display = 'none';
        }
    }

    function handleTestOptionClick(e) {
        if (!testMode) return;
        const optionItem = e.target.closest('.option-item');
        if (!optionItem) return;
        // Если уже ответили на этот вопрос, игнорируем
        if (testAnswers[testQuestionIndex] !== null) return;

        const optionIndex = parseInt(optionItem.dataset.optionIndex);
        const question = TICKETS_DATA[testTicketIndex].questions[testQuestionIndex];
        const isCorrect = question.options[optionIndex].correct;

        // Сохраняем ответ
        testAnswers[testQuestionIndex] = {
            selected: optionIndex,
            correct: isCorrect
        };

        // Перерисовываем карточку с подсветкой
        renderTestQuestion();
    }

    function finishTest() {
        const ticket = TICKETS_DATA[testTicketIndex];
        const total = ticket.questions.length;
        const correctCount = testAnswers.filter(a => a && a.correct).length;
        const wrongCount = testAnswers.filter(a => a && !a.correct).length;
        const unansweredCount = testAnswers.filter(a => a === null).length;

        // Скрываем вопросы и показываем результаты
        questionsList.style.display = 'none';
        testControlsTop.style.display = 'none';
        testControlsBottom.style.display = 'none';
        testResults.style.display = 'block';

        let resultHTML = `
            <div class="results-card">
                <h2 class="results-title">Результаты теста — Билет ${ticket.id}</h2>
                <div class="results-stats">
                    <div class="stat correct" data-category="correct"><span class="stat-num">${correctCount}</span> правильно</div>
                    <div class="stat wrong" data-category="wrong"><span class="stat-num">${wrongCount}</span> неправильно</div>
                    <div class="stat unanswered" data-category="unanswered"><span class="stat-num">${unansweredCount}</span> без ответа</div>
                </div>
                <div class="results-details">
                    <h3>Детализация:</h3>
                    ${ticket.questions.map((q, i) => {
                        const ans = testAnswers[i];
                        let statusClass = 'unanswered';
                        let statusText = 'Нет ответа';
                        if (ans) {
                            statusClass = ans.correct ? 'correct' : 'wrong';
                            statusText = ans.correct ? 'Правильно' : 'Неправильно';
                        }
                        return `
                            <div class="result-question" data-status="${statusClass}">
                                <div class="result-status ${statusClass}">${statusText}</div>
                                <div class="result-qtext">${q.text}</div>
                                <ul class="result-options">
                                    ${q.options.map((opt, oi) => {
                                        let cls = '';
                                        if (opt.correct) cls = 'correct';
                                        else if (ans && ans.selected === oi && !ans.correct) cls = 'wrong';
                                        let marker = '';
                                        if (opt.correct) marker = '✓';
                                        else if (ans && ans.selected === oi && !ans.correct) marker = '✗';
                                        return `<li class="${cls}"><span class="option-marker">${marker}</span> ${opt.text}</li>`;
                                    }).join('')}
                                </ul>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="results-actions">
                    <button class="btn btn-accent" id="retryTestBtn">Пройти заново</button>
                    <button class="btn" id="newTicketBtnResult"><i class="fa-solid fa-shuffle"></i> Новый билет</button>
                    <button class="btn" id="exitTestBtn">Выйти из теста</button>
                </div>
            </div>
        `;

        testResults.innerHTML = resultHTML;

        // Обработчики кнопок
        document.getElementById('retryTestBtn').addEventListener('click', () => {
            startTest(testTicketIndex);
        });
        document.getElementById('newTicketBtnResult').addEventListener('click', () => {
            loadNextRandomTicket();
        });
        document.getElementById('exitTestBtn').addEventListener('click', () => {
            testModeToggle.checked = false;
            toggleTestMode(false);
        });

        // ИНТЕРАКТИВНЫЕ КАРТОЧКИ СТАТИСТИКИ
        const statElements = document.querySelectorAll('.results-stats .stat');
        const allQuestions = document.querySelectorAll('.result-question');

        statElements.forEach(stat => {
            stat.style.cursor = 'pointer';
            stat.addEventListener('click', function () {
                const category = this.dataset.category;  // correct / wrong / unanswered
                const isActive = this.classList.contains('active');

                // Сброс, если кликнули по уже активной категории
                if (isActive) {
                    statElements.forEach(s => s.classList.remove('active'));
                    allQuestions.forEach(q => q.style.display = '');
                    return;
                }

                // Фильтрация
                statElements.forEach(s => s.classList.remove('active'));
                this.classList.add('active');

                allQuestions.forEach(q => {
                    if (q.dataset.status === category) {
                        q.style.display = '';
                    } else {
                        q.style.display = 'none';
                    }
                });
            });
        });
    }

    function loadNextRandomTicket() {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * TICKETS_DATA.length);
        } while (TICKETS_DATA.length > 1 && newIndex === testTicketIndex);
        startTest(newIndex);
    }

    // ========== THEME ==========
    function applyTheme(dark) {
        isDarkTheme = dark;
        document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
        themeToggle.checked = dark;
        localStorage.setItem('eb-theme', dark ? 'dark' : 'light');
    }

    // ========== SEARCH EVENTS ==========
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        searchQuery = query;
        if (query.length >= 2) {
            const results = performGlobalSearch(query);
            showDropdown(results);
            resetSearchBtn.style.display = '';
        } else {
            hideDropdown();
            resetSearchBtn.style.display = 'none';
            if (!testMode) {
                renderTicket(currentTicketIndex, '');
            }
        }
        updateSearchBadge();
    });

    searchInput.addEventListener('focus', () => {
        if (searchQuery.length >= 2) {
            const results = performGlobalSearch(searchQuery);
            showDropdown(results);
        }
    });

    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('searchWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            hideDropdown();
        }
    });

    searchDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const ticketIdx = parseInt(item.dataset.ticketIndex);
        if (testMode) {
            startTest(ticketIdx);
        } else {
            navigateToTicket(ticketIdx, searchQuery);
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchQuery = '';
            hideDropdown();
            resetSearchBtn.style.display = 'none';
            if (!testMode) {
                renderTicket(currentTicketIndex, '');
            }
            searchInput.blur();
        }
    });

    resetSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        hideDropdown();
        resetSearchBtn.style.display = 'none';
        if (!testMode) {
            renderTicket(currentTicketIndex, '');
        }
        searchInput.focus();
    });

    // ========== OTHER TOGGLES ==========
    themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));
    correctOnlyToggle.addEventListener('change', () => {
        correctOnly = correctOnlyToggle.checked;
        localStorage.setItem('eb-correct-only', correctOnly ? '1' : '0');
        if (!testMode) {
            renderTicket(currentTicketIndex, searchQuery);
        }
    });

    testModeToggle.addEventListener('change', () => {
        toggleTestMode(testModeToggle.checked);
    });

    // ========== TEST CONTROLS EVENTS ==========
    prevQuestionBtn.addEventListener('click', () => {
        if (testQuestionIndex > 0) {
            testQuestionIndex--;
            renderTestQuestion();
        }
    });

    nextQuestionBtn.addEventListener('click', () => {
        const ticket = TICKETS_DATA[testTicketIndex];
        if (testQuestionIndex < ticket.questions.length - 1) {
            testQuestionIndex++;
            renderTestQuestion();
        }
    });

    finishTestBtn.addEventListener('click', finishTest);

    finishTestBtnBottom.addEventListener('click', finishTest);

    nextTicketBtn.addEventListener('click', loadNextRandomTicket);

    // Делегирование кликов по вариантам ответов в режиме теста
    questionsList.addEventListener('click', handleTestOptionClick);

    // ========== KEYBOARD NAVIGATION ==========
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (testMode) {
                if (testQuestionIndex > 0) {
                    testQuestionIndex--;
                    renderTestQuestion();
                }
            } else {
                if (currentTicketIndex > 0) navigateToTicket(currentTicketIndex - 1, searchQuery);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (testMode) {
                const ticket = TICKETS_DATA[testTicketIndex];
                if (testQuestionIndex < ticket.questions.length - 1) {
                    testQuestionIndex++;
                    renderTestQuestion();
                }
            } else {
                if (currentTicketIndex < TICKETS_DATA.length - 1) navigateToTicket(currentTicketIndex + 1, searchQuery);
            }
        } else if (e.key === 'f' && e.ctrlKey) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // ========== INIT ==========
    function init() {
        const savedTheme = localStorage.getItem('eb-theme');
        if (savedTheme === 'dark') applyTheme(true);
        else if (savedTheme === 'light') applyTheme(false);
        else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);

        const savedCorrectOnly = localStorage.getItem('eb-correct-only');
        if (savedCorrectOnly === '1') {
            correctOnly = true;
            correctOnlyToggle.checked = true;
        }

        populateTicketSelect();

        let startIndex = 0;
        const hash = window.location.hash;
        if (hash && hash.startsWith('#ticket-')) {
            const ticketId = parseInt(hash.replace('#ticket-', ''));
            const found = TICKETS_DATA.findIndex(t => t.id === ticketId);
            if (found >= 0) startIndex = found;
        }
        renderTicket(startIndex);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('eb-theme')) applyTheme(e.matches);
        });
    }

    init();
    console.log('⚡ Режим теста активирован');
})();
