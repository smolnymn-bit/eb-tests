(function() {
    // ========== DATA ==========
    const TICKETS_DATA = window.TICKETS_DATA || [];

    // ========== STATE ==========
    let currentTicketIndex = 0;
    let correctOnly = false;

    let showCitations = false;

    let searchQuery = '';
    let isDarkTheme = false;

    // Новые переменные для теста
    let testMode = false;
    let testTicketIndex = 0;          // индекс билета в TICKETS_DATA
    let testQuestionIndex = 0;        // индекс вопроса в билете
    let testAnswers = [];             // массив ответов: null или {selected: Number, correct: Boolean}
    // Дополнительные параметры теста
    let testTicketData = null;        // текущий билет (может быть перемешанным или случайным)
    let isRandomMode = false;        // режим "Случайные вопросы"
    let soundEnabled = false;        // звук
    let autoAdvance = false;         // флаг автоперехода
    let autoAdvanceTimeout = null;   // идентификатор таймера
    let timerInterval = null;
    let timerSeconds = 0;
    let timerEndTime = null;  // время, когда таймер должен закончиться (мс Unix)

    // ========== DOM REFS ==========
    const $ = (s) => document.querySelector(s);
    const searchWrapper = document.getElementById('searchWrapper');
    const searchInput = $('#searchInput');
    const searchDropdown = $('#searchDropdown');
    const searchBadge = $('#searchBadge');
    const searchIcon = $('#searchIcon');
    const ticketSelect = $('#ticketSelect');
    const ticketPagination = $('#ticketPagination');
    const ticketTitle = $('#ticketTitle');
    const questionCount = $('#questionCount');
    const questionsList = $('#questionsList');
    const emptyState = $('#emptyState');
    const themeToggle = $('#themeToggle');
    const correctOnlyToggle = $('#correctOnlyToggle');

    const showCitationsToggle = $('#showCitationsToggle');

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

    const shuffleToggle = $('#shuffleToggle');
    const soundToggle = $('#soundToggle');
    const gridToggle = $('#gridToggle');
    const timerDisplay = $('#timerDisplay');
    const progressFill = $('#progressFill');
    const questionGrid = $('#questionGrid');
    const randomQuestionsBtn = $('#randomQuestionsBtn');
    const autoAdvanceToggle = $('#autoAdvanceToggle');

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

        // Сначала формируем блок выдержки (если нужно)
        const citationHtml = (showCitations && q.citation) ? `
            <div class="citation-block">
                <div class="citation-title">Выдержка из нормативки</div>
                <div class="citation-text">${q.citation.replace(/\n/g, '<br>')}</div>
            </div>` : '';

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
            ${citationHtml}
        `;
        return card;
    }

    function renderTicket(ticketIndex, highlightTerm = '') {
        if (ticketIndex < 0 || ticketIndex >= TICKETS_DATA.length) return;
        currentTicketIndex = ticketIndex;

        const ticket = TICKETS_DATA[ticketIndex];
        ticketTitle.textContent = `Билет № ${ticket.id}`;
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
        // updateSearchBadge();
        updateSearchIcon();
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
        // resetSearchBtn.style.display = searchTerm.length >= 2 ? '' : 'none';
        updateSearchIcon();
        hideDropdown();
        renderTicket(index, searchTerm);
        window.location.hash = `ticket-${TICKETS_DATA[index].id}`;
        ticketTitle.classList.remove('pulse-anim');
        void ticketTitle.offsetWidth;
        ticketTitle.classList.add('pulse-anim');
    }

    function updateSearchIcon() {
        const hasText = searchInput.value.trim().length > 0;
        const iconElement = searchIcon.querySelector('i');
        if (hasText) {
            // Меняем на крестик
            iconElement.className = 'fa-solid fa-times';
            searchIcon.classList.add('clear');
        } else {
            // Меняем на лупу
            iconElement.className = 'fa-solid fa-magnifying-glass';
            searchIcon.classList.remove('clear');
        }
    }

    // Клик по иконке поиска (крестик) – сброс
    searchIcon.addEventListener('click', () => {
        if (searchInput.value.trim().length > 0) {
            searchInput.value = '';
            searchQuery = '';
            hideDropdown();
            // Возврат к обычному отображению билета
            if (!testMode) {
                renderTicket(currentTicketIndex, '');
            }
            updateSearchIcon();
            searchInput.focus();
        }
    });

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

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // Звуковые эффекты (Web Audio API)  // осциллятор
    // function playSound(type) {
    //     if (!soundEnabled) return;
    //     try {
    //         const ctx = new (window.AudioContext || window.webkitAudioContext)();
    //         const osc = ctx.createOscillator();
    //         const gain = ctx.createGain();
    //         osc.connect(gain);
    //         gain.connect(ctx.destination);
    //         if (type === 'correct') {
    //             osc.frequency.value = 880;
    //             osc.type = 'sine';
    //             gain.gain.setValueAtTime(0.3, ctx.currentTime);
    //             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    //             osc.start(ctx.currentTime);
    //             osc.stop(ctx.currentTime + 0.2);
    //         } else {
    //             osc.frequency.value = 200;
    //             osc.type = 'square';
    //             gain.gain.setValueAtTime(0.3, ctx.currentTime);
    //             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    //             osc.start(ctx.currentTime);
    //             osc.stop(ctx.currentTime + 0.3);
    //         }
    //     } catch(e) {}
    // }

    function playSound(type) {
        if (!soundEnabled) return;
        try {
            const audioId = type === 'correct' ? 'soundCorrect' : 'soundWrong';
            const audio = document.getElementById(audioId);
            if (audio) {
                audio.currentTime = 0;  // перемотка на начало для быстрых повторных кликов
                audio.play().catch(e => {}); // игнорируем ошибки (например, если файла нет)
            }
        } catch(e) {}
    }

    // Таймер
    // function startTimer() {
    //     stopTimer();
    //     timerSeconds = 20 * 60; // 20 минут
    //     updateTimerDisplay();
    //     timerInterval = setInterval(() => {
    //         timerSeconds--;
    //         updateTimerDisplay();
    //         if (timerSeconds <= 0) {
    //             stopTimer();
    //             finishTest(); // автоматическое завершение
    //         }
    //     }, 1000);
    // }
    function startTimer() {
        stopTimer();
        const durationMs = 20 * 60 * 1000; // 20 минут в миллисекундах
        timerEndTime = Date.now() + durationMs;
        timerSeconds = Math.ceil((timerEndTime - Date.now()) / 1000);
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            const remaining = timerEndTime - Date.now();
            if (remaining <= 0) {
                timerSeconds = 0;
                updateTimerDisplay();
                stopTimer();
                finishTest();
                return;
            }
            timerSeconds = Math.ceil(remaining / 1000);
            updateTimerDisplay();
        }, 1000);
    }

    // function stopTimer() {
    //     if (timerInterval) {
    //         clearInterval(timerInterval);
    //         timerInterval = null;
    //     }
    // }
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        timerEndTime = null;
    }

    // function updateTimerDisplay() {
    //     const mins = Math.floor(timerSeconds / 60);
    //     const secs = timerSeconds % 60;
    //     timerDisplay.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    //     if (timerSeconds < 60) {
    //         timerDisplay.style.color = '#ef4444'; // красный, когда осталось меньше минуты
    //     } else {
    //         timerDisplay.style.color = '';
    //     }
    // }
    function updateTimerDisplay() {
        const mins = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        timerDisplay.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        if (timerSeconds < 60) {
            timerDisplay.style.color = '#ef4444'; // красный, когда осталось меньше минуты
        } else {
            timerDisplay.style.color = '';
        }
    }

    // Построение / обновление сетки вопросов
    function buildQuestionGrid() {
        if (!testTicketData) return;
        const questions = testTicketData.questions;
        questionGrid.innerHTML = '';
        questions.forEach((q, idx) => {
            const btn = document.createElement('button');
            btn.className = 'question-grid-btn';
            btn.textContent = idx + 1;
            // статус ответа
            const ans = testAnswers[idx];
            if (ans) {
                btn.classList.add(ans.correct ? 'correct-answer' : 'wrong-answer');
            } else {
                btn.classList.add('unanswered');
            }
            if (idx === testQuestionIndex) btn.classList.add('current');
            btn.addEventListener('click', () => {
                testQuestionIndex = idx;
                renderTestQuestion();
                buildQuestionGrid(); // обновить выделение
            });
            questionGrid.appendChild(btn);
        });
        // показать/скрыть согласно gridToggle
        questionGrid.style.display = gridToggle.checked ? 'flex' : 'none';
    }

    // ========== РЕЖИМ ТЕСТА ==========
    function toggleTestMode(enable) {
        testMode = enable;
        if (enable) {
            // Всегда начинаем новый тест при включении переключателя
            const randomIdx = Math.floor(Math.random() * TICKETS_DATA.length);
            startTest(randomIdx);
            const correctOnlyGroup = correctOnlyToggle.closest('.toggle-group');
            if (correctOnlyGroup) correctOnlyGroup.classList.add('hidden-placeholder');
            const citationsGroup = showCitationsToggle.closest('.toggle-group');
            if (citationsGroup) citationsGroup.classList.add('hidden-placeholder');
        } else {
            // Возврат к обычному режиму просмотра
            testControlsTop.style.display = 'none';
            testControlsBottom.style.display = 'none';
            stopTimer();
            questionGrid.style.display = 'none';
            testTicketData = null; // явно обнулять testTicketData, чтобы избежать случайных ссылок на старый тест:
            testResults.style.display = 'none';
            questionsList.style.display = '';
            ticketPagination.style.display = '';
            correctOnlyToggle.disabled = false;
            const correctOnlyGroup = correctOnlyToggle.closest('.toggle-group');
            if (correctOnlyGroup) correctOnlyGroup.classList.remove('hidden-placeholder');
            const citationsGroup = showCitationsToggle.closest('.toggle-group');
            if (citationsGroup) citationsGroup.classList.remove('hidden-placeholder');
            renderTicket(currentTicketIndex, searchQuery);
        }
    }

    function startTest(ticketIndex, options = {}) {
        const { randomQuestions = false, questionCount = 20 } = options;
        isRandomMode = randomQuestions;
        
        // Сбор данных для теста
        let questions;
        let ticketId;
        if (randomQuestions) {
            // Случайные вопросы из всех билетов
            const allQuestions = [];
            TICKETS_DATA.forEach(ticket => {
                ticket.questions.forEach(q => allQuestions.push({ ...q, ticketId: ticket.id }));
            });
            const totalAvailable = allQuestions.length;
            const count = Math.min(questionCount, totalAvailable);
            const selected = [];
            const usedIndices = new Set();
            while (selected.length < count) {
                const idx = Math.floor(Math.random() * totalAvailable);
                if (!usedIndices.has(idx)) {
                    usedIndices.add(idx);
                    selected.push(allQuestions[idx]);
                }
            }
            questions = selected;
            ticketId = '?'; // виртуальный билет
        } else {
            // Обычный билет
            const ticket = TICKETS_DATA[ticketIndex];
            questions = ticket.questions.map(q => ({ ...q }));
            ticketId = ticket.id;
        }

        // Перемешивание (если включено)
        if (shuffleToggle.checked) {
            shuffleArray(questions);
            questions = questions.map(q => {
                const opts = [...q.options];
                shuffleArray(opts);
                return { ...q, options: opts };
            });
        }

        testTicketData = { id: ticketId, questions };
        testTicketIndex = ticketIndex; // для информации, хотя не используется при random
        testQuestionIndex = 0;
        testAnswers = new Array(questions.length).fill(null);
        // Синхронизация селектора билетов
        if (randomQuestions) {
            ticketSelect.disabled = true;   // в случайном режиме блокируем выбор билета
        } else {
            ticketSelect.disabled = false;
            ticketSelect.value = ticketIndex;
}

        // UI
        testControlsTop.style.display = 'flex';
        testControlsBottom.style.display = 'flex';
        testResults.style.display = 'none';
        ticketPagination.style.display = 'none';
        questionsList.style.display = '';
        correctOnlyToggle.disabled = true;

        const ticketLabel = randomQuestions ? 'Случайные вопросы' : `Билет ${ticketId}`;
        ticketTitle.textContent = `${ticketLabel} (тест)`;
        questionCount.textContent = `${questions.length} вопросов`;

        // Таймер
        if (randomQuestions) {
            timerDisplay.style.display = 'none'; // без таймера
            stopTimer();
        } else {
            timerDisplay.style.display = '';
            startTimer();
        }

        renderTestQuestion();
        autoAdvanceToggle.checked = autoAdvance;
        buildQuestionGrid();
    }

    function renderTestQuestion() {
        if (!testTicketData) return;
        const ticket = testTicketData;
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
                    if (userAnswer) {
                        if (opt.correct) {
                            cls += ' correct';
                            marker = '✓';
                        } else if (userAnswer.selected === oi) {
                            cls += ' wrong';
                            marker = '✗';
                        }
                    }
                    return `
                        <li class="${cls}" data-option-index="${oi}">
                            <span class="option-marker">${marker}</span>
                            <span>${opt.text}</span>
                        </li>`;
                }).join('')}
            </ul>
        `;
        questionsList.appendChild(card);

        // Прогресс
        const total = ticket.questions.length;
        const current = testQuestionIndex + 1;
        questionProgress.textContent = `${current} вопрос из ${total}`;
        progressFill.style.width = (current / total * 100) + '%';

        // Кнопки
        prevQuestionBtn.disabled = testQuestionIndex === 0;
        nextQuestionBtn.disabled = testQuestionIndex === total - 1;

        // Верхняя панель: завершить только после первого ответа
        const anyAnswered = testAnswers.some(a => a !== null);
        finishTestBtn.style.display = anyAnswered ? 'inline-flex' : 'none';

        // Нижняя кнопка Завершить вместо Следующий вопрос на последнем вопросе при всех ответах
        const isLast = testQuestionIndex === total - 1;
        const allAnswered = testAnswers.every(a => a !== null);
        if (isLast && allAnswered) {
            nextQuestionBtn.style.display = 'none';
            finishTestBtnBottom.style.display = 'inline-flex';
        } else {
            nextQuestionBtn.style.display = 'inline-flex';
            finishTestBtnBottom.style.display = 'none';
        }

        // Сброс таймера автоперехода
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }

        // Обновить сетку (сохраняя видимость)
        if (gridToggle.checked) buildQuestionGrid();

        // Прокрутка к нижним кнопкам на мобильных экранах
        if (window.innerWidth <= 768) {
            const bottom = testControlsBottom;
            if (bottom && bottom.style.display !== 'none') {
                const rect = bottom.getBoundingClientRect();
                if (rect.bottom > window.innerHeight || rect.top < 0) {
                    bottom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }

    function handleTestOptionClick(e) {
        if (!testMode) return;
        const optionItem = e.target.closest('.option-item');
        if (!optionItem) return;
        // Если уже ответили на этот вопрос, игнорируем
        if (testAnswers[testQuestionIndex] !== null) return;

        const optionIndex = parseInt(optionItem.dataset.optionIndex);
        const question = testTicketData.questions[testQuestionIndex];
        const isCorrect = question.options[optionIndex].correct;

        // Сохраняем ответ
        testAnswers[testQuestionIndex] = {
            selected: optionIndex,
            correct: isCorrect
        };

        playSound(isCorrect ? 'correct' : 'wrong');
        renderTestQuestion();
        // Автопереход только при правильном ответе
        if (autoAdvance && isCorrect) {
            const total = testTicketData.questions.length;
            if (testQuestionIndex < total - 1) {
                autoAdvanceTimeout = setTimeout(() => {
                    testQuestionIndex++;
                    renderTestQuestion();
                }, 1000);
            }
        }
    }

    function finishTest() {
        const ticket = testTicketData;
        const total = ticket.questions.length;
        const correctCount = testAnswers.filter(a => a && a.correct).length;
        const wrongCount = testAnswers.filter(a => a && !a.correct).length;
        const unansweredCount = testAnswers.filter(a => a === null).length;

        // Скрываем вопросы и показываем результаты
        questionsList.style.display = 'none';
        testControlsTop.style.display = 'none';
        testControlsBottom.style.display = 'none';
        stopTimer();
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        questionGrid.style.display = 'none';
        ticketSelect.disabled = false;
        testResults.style.display = 'block';
        // Показать тумблер выдержек на странице результатов
        const citationsGroup = showCitationsToggle.closest('.toggle-group');
        if (citationsGroup) citationsGroup.classList.remove('hidden-placeholder');

        let resultHTML = `
            <div class="results-card">
                <!-- <h2 class="results-title">Результаты теста — Билет ${ticket.id}</h2> -->
                <h2 class="results-title">Результаты теста — Билет ${ticket.id === '?' ? 'Случайные вопросы' : ticket.id}</h2>
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
                                ${showCitations && q.citation ? `
                                <div class="citation-block" style="margin-top:0.75rem;">
                                    <div class="citation-title">Выдержка из нормативки</div>
                                    <div class="citation-text">${q.citation.replace(/\n/g, '<br>')}</div>
                                </div>` : ''}
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

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        searchQuery = query;
        if (query.length >= 2) {
            const results = performGlobalSearch(query);
            showDropdown(results);
        } else {
            hideDropdown();
            if (!testMode) {
                renderTicket(currentTicketIndex, '');
            }
        }
        updateSearchIcon();
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
            if (!testMode) {
                renderTicket(currentTicketIndex, '');
            }
            searchInput.blur();
            updateSearchIcon();
        }
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

    showCitationsToggle.addEventListener('change', () => {
        showCitations = showCitationsToggle.checked;
        localStorage.setItem('eb-show-citations', showCitations ? '1' : '0');
        if (!testMode) {
            renderTicket(currentTicketIndex, searchQuery);
        } else if (testResults.style.display !== 'none') {
            // Перерисовка результатов с учётом выдержек
            finishTest();
        }
    });

    testModeToggle.addEventListener('change', () => {
        toggleTestMode(testModeToggle.checked);
    });

    // ========== TEST CONTROLS EVENTS ==========

    // Звук
    soundToggle.addEventListener('change', () => {
        soundEnabled = soundToggle.checked;
        localStorage.setItem('eb-sound', soundEnabled ? '1' : '0');
    });

    // Сетка
    gridToggle.addEventListener('change', () => {
        questionGrid.style.display = gridToggle.checked ? 'flex' : 'none';
        if (gridToggle.checked) buildQuestionGrid();
    });

    // Случайные вопросы
    randomQuestionsBtn.addEventListener('click', () => {
        const num = prompt('Сколько вопросов (максимум 50)?', '20');
        const count = parseInt(num, 10);
        if (isNaN(count) || count < 1) return;
        const realCount = Math.min(count, 50);
        startTest(0, { randomQuestions: true, questionCount: realCount });
    });

    // Автопереход
    autoAdvanceToggle.addEventListener('change', () => {
        autoAdvance = autoAdvanceToggle.checked;
        if (!autoAdvance && autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
    });

    // Перемешивание – перезапуск теста при изменении
    shuffleToggle.addEventListener('change', () => {
        if (!testMode) return;
        // Сохраняем текущий тип теста (обычный билет или случайный)
        if (isRandomMode) {
            // Перезапускаем случайный тест с тем же количеством вопросов
            const currentCount = testAnswers.length;
            startTest(0, { randomQuestions: true, questionCount: currentCount });
        } else {
            // Перезапускаем текущий билет
            startTest(testTicketIndex);
        }
    });

    prevQuestionBtn.addEventListener('click', () => {
        if (testQuestionIndex > 0) {
            testQuestionIndex--;
            renderTestQuestion();
        }
    });

    nextQuestionBtn.addEventListener('click', () => {
        // const ticket = TICKETS_DATA[testTicketIndex];
        const ticket = testTicketData;
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
                const ticket = testTicketData;
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

        const savedShowCitations = localStorage.getItem('eb-show-citations');
        if (savedShowCitations === '1') {
            showCitations = true;
            showCitationsToggle.checked = true;
        }

        const savedSound = localStorage.getItem('eb-sound');
        if (savedSound === '1') {
            soundEnabled = true;
            soundToggle.checked = true;
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
    // Кнопка "Наверх"
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        });
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    console.log('⚡ Режим теста активирован');
})();
