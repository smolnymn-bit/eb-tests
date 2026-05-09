(function() {
    const TICKETS_DATA = window.TICKETS_DATA || [];
    let currentTicketIndex = 0;
    let correctOnly = false;
    let showCitations = false;
    let searchQuery = '';
    // let isDarkTheme = false;
    let testMode = false;
    let testTicketIndex = 0;
    let testQuestionIndex = 0;
    let testAnswers = [];
    let testTicketData = null;
    let isRandomMode = false;
    let soundEnabled = false;
    let autoAdvance = false;
    let autoAdvanceTimeout = null;
    let timerInterval = null;
    let timerSeconds = 0;
    let timerEndTime = null;
    let citationsAutoShown = false;   // предотвращает повторное авто‑включение выдержек
    let isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

    // DOM refs (основные)
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
    const testControlsTop = $('#testControlsTop');
    const testControlsBottom = $('#testControlsBottom');
    const testResults = $('#testResults');
    const prevQuestionBtn = $('#prevQuestionBtn');
    const nextQuestionBtn = $('#nextQuestionBtn');
    const finishTestBtn = $('#finishTestBtn');
    const finishTestBtnBottom = $('#finishTestBtnBottom');
    const nextTicketBtn = $('#nextTicketBtn');
    const questionProgress = $('#questionProgress');
    const timerDisplay = $('#timerDisplay');
    const progressFill = $('#progressFill');
    const questionGrid = $('#questionGrid');
    const randomQuestionsBtn = $('#randomQuestionsBtn');

    // Сайдбар
    const burgerBtn = document.getElementById('burgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const sidebarThemeToggle = document.getElementById('sidebarThemeToggle');
    const sidebarTestModeToggle = document.getElementById('sidebarTestModeToggle');
    const sidebarCorrectOnlyToggle = document.getElementById('sidebarCorrectOnlyToggle');
    const sidebarCitationsToggle = document.getElementById('sidebarCitationsToggle');
    const sidebarSoundToggle = document.getElementById('sidebarSoundToggle');
    const sidebarShuffleToggle = document.getElementById('sidebarShuffleToggle');
    const sidebarGridToggle = document.getElementById('sidebarGridToggle');
    const sidebarAutoAdvanceToggle = document.getElementById('sidebarAutoAdvanceToggle');
    const testOptionsGroup = document.getElementById('testOptionsGroup');

    // UTILS
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
                    results.push({ ticketIndex: tIdx, ticketId: ticket.id, questionIndex: qIdx, text: q.text, matchType: 'question' });
                } else {
                    for (let opt of q.options) {
                        if (opt.text.toLowerCase().includes(lower)) {
                            results.push({ ticketIndex: tIdx, ticketId: ticket.id, questionIndex: qIdx, text: q.text, matchType: 'option' });
                            break;
                        }
                    }
                }
            });
        });
        return results.slice(0, 20);
    }
    function showDropdown(results) {
        if (!results.length) { searchDropdown.style.display = 'none'; return; }
        searchDropdown.innerHTML = results.map(r => `
            <div class="dropdown-item" data-ticket-index="${r.ticketIndex}" data-question-index="${r.questionIndex}">
                <span class="dropdown-badge">Б.${r.ticketId} В.${r.questionIndex+1}</span>
                <span class="dropdown-text">${escapeHTML(r.text.substring(0, 80))}${r.text.length>80?'…':''}</span>
            </div>
        `).join('');
        searchDropdown.style.display = 'block';
    }
    function hideDropdown() { searchDropdown.style.display = 'none'; }
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
    function playSound(type) {
        if (!soundEnabled) return;
        try {
            const audioId = type === 'correct' ? 'soundCorrect' : 'soundWrong';
            const audio = document.getElementById(audioId);
            if (audio) { audio.currentTime = 0; audio.play().catch(e => {}); }
        } catch(e) {}
    }

    // RENDER
    function renderQuestionCard(q, index, highlightTerm) {
        const showAll = !correctOnly;
        const card = document.createElement('div');
        card.className = 'question-card';
        card.setAttribute('data-question-index', index);
        const numLabel = `ВОПРОС ${index + 1} / 10`;
        const qText = highlightTerm.length >= 2 ? highlightText(q.text, highlightTerm) : q.text;
        const citationHtml = (showCitations && q.citation) ? `
            <div class="citation-block">
                <div class="citation-title">Выдержка из нормативки</div>
                <div class="citation-text">${escapeHTML(q.citation).replace(/\n/g, '<br>')}</div>
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
                    return `<li class="${cls}"><span class="option-marker">${marker}</span><span>${optText}</span></li>`;
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
        ticket.questions.forEach((q, i) => questionsList.appendChild(renderQuestionCard(q, i, highlightTerm)));
        renderPagination(ticketIndex);
        updateSearchIcon();
    }

    function renderPagination(activeIndex) {
        const total = TICKETS_DATA.length;
        const isSmall = window.innerWidth <= 480;
        let start = Math.max(0, activeIndex - (isSmall ? 1 : 2));
        let end = Math.min(total - 1, activeIndex + (isSmall ? 1 : 2));
        if (end - start < (isSmall ? 2 : 4)) {
            if (start === 0) end = Math.min(total - 1, start + (isSmall ? 2 : 4));
            else if (end === total - 1) start = Math.max(0, end - (isSmall ? 2 : 4));
        }
        const visiblePages = [];
        for (let i = start; i <= end; i++) visiblePages.push(i);
        ticketPagination.innerHTML = '';
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn'; prevBtn.textContent = '←'; prevBtn.disabled = activeIndex === 0;
        prevBtn.addEventListener('click', () => navigateToTicket(activeIndex - 1));
        ticketPagination.appendChild(prevBtn);
        if (visiblePages[0] > 0) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'page-btn'; firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => navigateToTicket(0));
            ticketPagination.appendChild(firstBtn);
            if (visiblePages[0] > 1) {
                const dots = document.createElement('span'); dots.textContent = '…';
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
                const dots = document.createElement('span'); dots.textContent = '…';
                dots.style.cssText = 'padding:0 4px;color:var(--text-secondary);font-size:0.8rem;';
                ticketPagination.appendChild(dots);
            }
            const lastBtn = document.createElement('button');
            lastBtn.className = 'page-btn'; lastBtn.textContent = total;
            lastBtn.addEventListener('click', () => navigateToTicket(total - 1));
            ticketPagination.appendChild(lastBtn);
        }
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn'; nextBtn.textContent = '→'; nextBtn.disabled = activeIndex === total - 1;
        nextBtn.addEventListener('click', () => navigateToTicket(activeIndex + 1));
        ticketPagination.appendChild(nextBtn);
    }

    function navigateToTicket(index, searchTerm = '') {
        if (index < 0 || index >= TICKETS_DATA.length) return;
        currentTicketIndex = index;
        searchInput.value = searchTerm;
        searchQuery = searchTerm;
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
            iconElement.className = 'fa-solid fa-times';
            searchIcon.classList.add('clear');
        } else {
            iconElement.className = 'fa-solid fa-magnifying-glass';
            searchIcon.classList.remove('clear');
        }
    }

    searchIcon.addEventListener('click', () => {
        if (searchInput.value.trim().length > 0) {
            searchInput.value = '';
            searchQuery = '';
            hideDropdown();
            if (!testMode) renderTicket(currentTicketIndex, '');
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
            if (testMode) startTest(idx);
            else navigateToTicket(idx, searchQuery);
        });
    }

    // Таймер
    function startTimer() {
        stopTimer();
        const durationMs = 20 * 60 * 1000;
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
    function stopTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerEndTime = null;
    }
    function updateTimerDisplay() {
        const mins = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        timerDisplay.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        timerDisplay.style.color = timerSeconds < 60 ? '#ef4444' : '';
    }

    function buildQuestionGrid() {
        if (!testTicketData) return;
        questionGrid.innerHTML = '';
        testTicketData.questions.forEach((_, idx) => {
            const btn = document.createElement('button');
            btn.className = 'question-grid-btn';
            btn.textContent = idx + 1;
            const ans = testAnswers[idx];
            if (ans) btn.classList.add(ans.correct ? 'correct-answer' : 'wrong-answer');
            else btn.classList.add('unanswered');
            if (idx === testQuestionIndex) btn.classList.add('current');
            btn.addEventListener('click', () => {
                testQuestionIndex = idx;
                renderTestQuestion();
                buildQuestionGrid();
            });
            questionGrid.appendChild(btn);
        });
        questionGrid.style.display = sidebarGridToggle && sidebarGridToggle.checked ? 'flex' : 'none';
    }

    // function updateSidebarUI() {
    //     if (sidebarThemeToggle) sidebarThemeToggle.checked = isDarkTheme;
    //     if (sidebarTestModeToggle) sidebarTestModeToggle.checked = testMode;
    //     if (sidebarCorrectOnlyToggle) sidebarCorrectOnlyToggle.checked = correctOnly;
    //     if (sidebarCitationsToggle) sidebarCitationsToggle.checked = showCitations;
    //     if (sidebarSoundToggle) sidebarSoundToggle.checked = soundEnabled;
    //     if (sidebarShuffleToggle) sidebarShuffleToggle.checked = sidebarShuffleToggle ? sidebarShuffleToggle.checked : false;
    //     if (sidebarGridToggle) sidebarGridToggle.checked = sidebarGridToggle ? sidebarGridToggle.checked : false;
    //     if (sidebarAutoAdvanceToggle) sidebarAutoAdvanceToggle.checked = autoAdvance;
    //     if (testOptionsGroup) testOptionsGroup.style.display = testMode ? '' : 'none';

    //     const isResultsVisible = testResults.style.display === 'block';
    //     const isTestActive = testMode && !isResultsVisible;

    //     const correctGroup = sidebarCorrectOnlyToggle ? sidebarCorrectOnlyToggle.closest('.sidebar-toggle') : null;
    //     const citationsGroup = sidebarCitationsToggle ? sidebarCitationsToggle.closest('.sidebar-toggle') : null;

    //     if (correctGroup) correctGroup.classList.toggle('disabled-override', isTestActive);
    //     if (citationsGroup) citationsGroup.classList.toggle('disabled-override', isTestActive);

    //     const themeLabel = document.getElementById('sidebarThemeLabel');
    //     if (themeLabel) themeLabel.textContent = isDarkTheme ? 'Светлая тема' : 'Тёмная тема';

    //     const testModeLabel = document.getElementById('sidebarTestModeLabel');
    //     if (testModeLabel) testModeLabel.textContent = testMode ? 'Режим обучения' : 'Режим теста';
    // }
    function updateSidebarUI() {
        if (sidebarThemeToggle) sidebarThemeToggle.checked = isDarkTheme;
        if (sidebarTestModeToggle) sidebarTestModeToggle.checked = testMode;
        if (sidebarCorrectOnlyToggle) sidebarCorrectOnlyToggle.checked = correctOnly;
        if (sidebarCitationsToggle) sidebarCitationsToggle.checked = showCitations;
        if (sidebarSoundToggle) sidebarSoundToggle.checked = soundEnabled;
        if (sidebarShuffleToggle) sidebarShuffleToggle.checked = sidebarShuffleToggle ? sidebarShuffleToggle.checked : false;
        if (sidebarGridToggle) sidebarGridToggle.checked = sidebarGridToggle ? sidebarGridToggle.checked : false;
        if (sidebarAutoAdvanceToggle) sidebarAutoAdvanceToggle.checked = autoAdvance;
        if (testOptionsGroup) testOptionsGroup.style.display = testMode ? '' : 'none';

        const isResultsVisible = testResults.style.display === 'block';
        const correctGroup = sidebarCorrectOnlyToggle ? sidebarCorrectOnlyToggle.closest('.sidebar-toggle') : null;
        const citationsGroup = sidebarCitationsToggle ? sidebarCitationsToggle.closest('.sidebar-toggle') : null;

        // «Только верные» блокируется всегда в тесте и на странице результатов,
        // «Выдержки» блокируются только во время активного теста (не на результатах)
        if (correctGroup) {
            correctGroup.classList.toggle('disabled-override', testMode);   // блокирован, пока длится тест (включая результаты)
        }
        if (citationsGroup) {
            citationsGroup.classList.toggle('disabled-override', testMode && !isResultsVisible);
        }

        const themeLabel = document.getElementById('sidebarThemeLabel');
        if (themeLabel) themeLabel.textContent = isDarkTheme ? 'Тема' : 'Тема';

        const testModeLabel = document.getElementById('sidebarTestModeLabel');
        if (testModeLabel) testModeLabel.textContent = testMode ? 'Режим обучения' : 'Режим теста';
    }

    // Тестовый режим
    // function toggleTestMode(enable) {
    //     testMode = enable;
    //     if (enable) {
    //         // Автоматически сбрасываем "Только верные" перед тестом
    //         if (correctOnly) {
    //             correctOnly = false;
    //             localStorage.setItem('eb-correct-only', '0');
    //         }
    //         toggleTestModeUI(true);
    //         startTest(Math.floor(Math.random() * TICKETS_DATA.length));
    //     } else {
    //         toggleTestModeUI(false);
    //         renderTicket(currentTicketIndex, searchQuery);
    //     }
    //     updateSidebarUI();
    // }
    function toggleTestMode(enable) {
        testMode = enable;
        if (enable) {
            // Принудительно выключаем «Только верные» при входе в тест
            if (correctOnly) {
                correctOnly = false;
                localStorage.setItem('eb-correct-only', '0');
            }
            toggleTestModeUI(true);
            startTest(Math.floor(Math.random() * TICKETS_DATA.length));
        } else {
            toggleTestModeUI(false);
            renderTicket(currentTicketIndex, searchQuery);
        }
        updateSidebarUI();
    }

    // function toggleTestModeUI(enable) {
    //     testControlsTop.style.display = enable ? 'flex' : 'none';
    //     testControlsBottom.style.display = enable ? 'flex' : 'none';
    //     questionGrid.style.display = 'none';
    //     if (!enable) stopTimer();
    //     testResults.style.display = 'none';
    //     ticketPagination.style.display = enable ? 'none' : '';
    //     testTicketData = enable ? testTicketData : null;
    // }
    function toggleTestModeUI(enable) {
        testControlsTop.style.display = enable ? 'flex' : 'none';
        testControlsBottom.style.display = enable ? 'flex' : 'none';
        questionGrid.style.display = 'none';
        if (!enable) stopTimer();
        testResults.style.display = 'none';
        ticketPagination.style.display = enable ? 'none' : '';
        questionsList.style.display = enable ? '' : 'none';   // ← добавить
        emptyState.style.display = 'none';                     // ← добавить
        testTicketData = enable ? testTicketData : null;
    }

    function startTest(ticketIndex, options = {}) {
        const { randomQuestions = false, questionCount = 20 } = options;
        toggleTestModeUI(true);
        isRandomMode = randomQuestions;
        citationsAutoShown = false;  // сбрасываем флаг авто‑показа выдержек
        let questions, ticketId;
        if (randomQuestions) {
            const allQuestions = [];
            TICKETS_DATA.forEach(ticket => {
                ticket.questions.forEach(q => allQuestions.push({ ...q, ticketId: ticket.id }));
            });
            const count = Math.min(questionCount, allQuestions.length);
            const selected = [];
            const used = new Set();
            while (selected.length < count) {
                const idx = Math.floor(Math.random() * allQuestions.length);
                if (!used.has(idx)) { used.add(idx); selected.push(allQuestions[idx]); }
            }
            questions = selected;
            ticketId = '?';
        } else {
            const ticket = TICKETS_DATA[ticketIndex];
            questions = ticket.questions.map(q => ({ ...q }));
            ticketId = ticket.id;
        }
        if (sidebarShuffleToggle && sidebarShuffleToggle.checked) {
            shuffleArray(questions);
            questions = questions.map(q => { const opts = [...q.options]; shuffleArray(opts); return { ...q, options: opts }; });
        }
        testTicketData = { id: ticketId, questions };
        testTicketIndex = ticketIndex;
        testQuestionIndex = 0;
        testAnswers = new Array(questions.length).fill(null);
        ticketSelect.disabled = randomQuestions;
        if (!randomQuestions) ticketSelect.value = ticketIndex;
        ticketTitle.textContent = `${randomQuestions ? 'Случайные вопросы' : `Билет ${ticketId}`} (тест)`;
        questionCount.textContent = `${questions.length} вопросов`;
        timerDisplay.style.display = randomQuestions ? 'none' : '';
        if (!randomQuestions) startTimer(); else stopTimer();
        renderTestQuestion();
        buildQuestionGrid();
        updateSidebarUI();
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
        card.innerHTML = `
            <div class="q-number">ВОПРОС ${testQuestionIndex + 1} / ${ticket.questions.length}</div>
            <div class="q-text">${q.text}</div>
            <ul class="options-list">
                ${q.options.map((opt, oi) => {
                    let cls = 'option-item', marker = '';
                    if (userAnswer) {
                        if (opt.correct) { cls += ' correct'; marker = '✓'; }
                        else if (userAnswer.selected === oi) { cls += ' wrong'; marker = '✗'; }
                    }
                    return `<li class="${cls}" data-option-index="${oi}"><span class="option-marker">${marker}</span><span>${opt.text}</span></li>`;
                }).join('')}
            </ul>
        `;
        questionsList.appendChild(card);
        const total = ticket.questions.length;
        questionProgress.textContent = `${testQuestionIndex + 1} вопрос из ${total}`;
        progressFill.style.width = (testQuestionIndex + 1) / total * 100 + '%';
        prevQuestionBtn.disabled = testQuestionIndex === 0;
        nextQuestionBtn.disabled = testQuestionIndex === total - 1;
        finishTestBtn.style.display = testAnswers.some(a => a !== null) ? 'inline-flex' : 'none';
        const isLast = testQuestionIndex === total - 1;
        const allAnswered = testAnswers.every(a => a !== null);
        if (isLast && allAnswered) {
            nextQuestionBtn.style.display = 'none';
            finishTestBtnBottom.style.display = 'inline-flex';
        } else {
            nextQuestionBtn.style.display = 'inline-flex';
            finishTestBtnBottom.style.display = 'none';
        }
        if (autoAdvanceTimeout) { clearTimeout(autoAdvanceTimeout); autoAdvanceTimeout = null; }
        if (sidebarGridToggle && sidebarGridToggle.checked) buildQuestionGrid();
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
        if (!optionItem || testAnswers[testQuestionIndex] !== null) return;
        const optionIndex = parseInt(optionItem.dataset.optionIndex);
        const question = testTicketData.questions[testQuestionIndex];
        const isCorrect = question.options[optionIndex].correct;
        testAnswers[testQuestionIndex] = { selected: optionIndex, correct: isCorrect };
        playSound(isCorrect ? 'correct' : 'wrong');
        renderTestQuestion();
        if (autoAdvance && isCorrect) {
            const total = testTicketData.questions.length;
            if (testQuestionIndex < total - 1) {
                autoAdvanceTimeout = setTimeout(() => { testQuestionIndex++; renderTestQuestion(); }, 1000);
            }
        }
    }

    function finishTest() {
        const ticket = testTicketData;
        const total = ticket.questions.length;
        const correctCount = testAnswers.filter(a => a && a.correct).length;
        const wrongCount = testAnswers.filter(a => a && !a.correct).length;
        const unansweredCount = testAnswers.filter(a => a === null).length;
        questionsList.style.display = 'none';
        testControlsTop.style.display = 'none';
        testControlsBottom.style.display = 'none';
        stopTimer();
        if (autoAdvanceTimeout) { clearTimeout(autoAdvanceTimeout); autoAdvanceTimeout = null; }
        questionGrid.style.display = 'none';
        ticketSelect.disabled = false;
        testResults.style.display = 'block';

        // Автоматически включаем выдержки только один раз за тест
        if (!citationsAutoShown) {
            if (!showCitations) {
                showCitations = true;
                localStorage.setItem('eb-show-citations', '1');
            }
            citationsAutoShown = true;
        }

        let resultHTML = `
            <div class="results-card">
                <h2 class="results-title">Результаты теста — ${ticket.id === '?' ? 'Случайные вопросы' : `Билет ${ticket.id}`}</h2>
                <div class="results-stats">
                    <div class="stat correct" data-category="correct"><span class="stat-num">${correctCount}</span> правильно</div>
                    <div class="stat wrong" data-category="wrong"><span class="stat-num">${wrongCount}</span> неправильно</div>
                    <div class="stat unanswered" data-category="unanswered"><span class="stat-num">${unansweredCount}</span> без ответа</div>
                </div>
                <div class="results-actions">
                    <button class="btn btn-accent" id="retryTestBtn">Пройти заново</button>
                    <button class="btn" id="newTicketBtnResult"><i class="fa-solid fa-shuffle"></i> Новый билет</button>
                    <button class="btn" id="exitTestBtn">Выйти из теста</button>
                </div>
                <div class="results-details">
                    <h3>Детализация:</h3>
                    ${ticket.questions.map((q, i) => {
                        const ans = testAnswers[i];
                        let statusClass = 'unanswered', statusText = 'Нет ответа';
                        if (ans) { statusClass = ans.correct ? 'correct' : 'wrong'; statusText = ans.correct ? 'Правильно' : 'Неправильно'; }
                        return `
                            <div class="result-question" data-status="${statusClass}">
                                <div class="result-status ${statusClass}">${statusText}</div>
                                <div class="result-qtext">${q.text}</div>
                                <ul class="result-options">
                                    ${q.options.map((opt, oi) => {
                                        let cls = '';
                                        let marker = '';
                                        if (opt.correct) {
                                            cls = 'correct';
                                            marker = '✓';
                                        } else if (ans && ans.selected === oi && !ans.correct) {
                                            cls = 'wrong';
                                            marker = '✗';
                                        } else {
                                            // не выбран и не правильный – просто пустой кружок
                                            marker = '';
                                        }
                                        return `<li class="${cls}"><span class="option-marker">${marker}</span> ${opt.text}</li>`;
                                    }).join('')}
                                </ul>
                                ${showCitations && q.citation ? `<div class="citation-block" style="margin-top:0.75rem;"><div class="citation-title">Выдержка из нормативки</div><div class="citation-text">${escapeHTML(q.citation).replace(/\n/g, '<br>')}</div></div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="results-actions">
                    <button class="btn btn-accent" id="retryTestBtn-bottom">Пройти заново</button>
                    <button class="btn" id="newTicketBtnResult-bottom"><i class="fa-solid fa-shuffle"></i> Новый билет</button>
                    <button class="btn" id="exitTestBtn-bottom">Выйти из теста</button>
                </div>
            </div>
        `;
        testResults.innerHTML = resultHTML;
        // В finishTest(), после вставки innerHTML:
        document.getElementById('retryTestBtn').addEventListener('click', () => startTest(testTicketIndex));
        document.getElementById('retryTestBtn-bottom').addEventListener('click', () => startTest(testTicketIndex));

        document.getElementById('newTicketBtnResult').addEventListener('click', () => loadNextRandomTicket());
        document.getElementById('newTicketBtnResult-bottom').addEventListener('click', () => loadNextRandomTicket());

        document.getElementById('exitTestBtn').addEventListener('click', () => {
            sidebarTestModeToggle.checked = false;
            toggleTestMode(false);
        });
        document.getElementById('exitTestBtn-bottom').addEventListener('click', () => {
            sidebarTestModeToggle.checked = false;
            toggleTestMode(false);
        });
        document.getElementById('retryTestBtn').addEventListener('click', () => startTest(testTicketIndex));
        document.getElementById('newTicketBtnResult').addEventListener('click', () => loadNextRandomTicket());
        document.getElementById('exitTestBtn').addEventListener('click', () => {
            sidebarTestModeToggle.checked = false;
            toggleTestMode(false);
        });
        // интерактивные карточки
        const statElements = document.querySelectorAll('.results-stats .stat');
        const allQuestions = document.querySelectorAll('.result-question');
        statElements.forEach(stat => {
            stat.style.cursor = 'pointer';
            stat.addEventListener('click', function () {
                const category = this.dataset.category;
                const isActive = this.classList.contains('active');
                statElements.forEach(s => s.classList.remove('active'));
                if (isActive) { allQuestions.forEach(q => q.style.display = ''); return; }
                this.classList.add('active');
                allQuestions.forEach(q => q.style.display = q.dataset.status === category ? '' : 'none');
            });
        });
        updateSidebarUI();
    }

    // function loadNextRandomTicket() {
    //     let newIndex;
    //     do { newIndex = Math.floor(Math.random() * TICKETS_DATA.length); } while (TICKETS_DATA.length > 1 && newIndex === testTicketIndex);
    //     startTest(newIndex);
    // }
    function loadNextRandomTicket() {
        if (TICKETS_DATA.length === 0) return;
        let newIndex;
        if (TICKETS_DATA.length === 1) {
            newIndex = 0; // единственный билет
        } else {
            // Выбираем случайный билет, исключая текущий
            do {
                newIndex = Math.floor(Math.random() * TICKETS_DATA.length);
            } while (newIndex === testTicketIndex);
        }
        startTest(newIndex);
    }

    function applyTheme(dark) {
        isDarkTheme = dark;
        // document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('eb-theme', dark ? 'dark' : 'light');
        updateSidebarUI();
    }

    // События поиска
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        searchQuery = query;
        if (query.length >= 2) showDropdown(performGlobalSearch(query));
        else { hideDropdown(); if (!testMode) renderTicket(currentTicketIndex, ''); }
        updateSearchIcon();
    });
    searchInput.addEventListener('focus', () => { if (searchQuery.length >= 2) showDropdown(performGlobalSearch(searchQuery)); });
    document.addEventListener('click', (e) => { if (!searchWrapper.contains(e.target)) hideDropdown(); });
    searchDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const ticketIdx = parseInt(item.dataset.ticketIndex);
        if (testMode) startTest(ticketIdx); else navigateToTicket(ticketIdx, searchQuery);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = ''; searchQuery = ''; hideDropdown();
            if (!testMode) renderTicket(currentTicketIndex, ''); searchInput.blur(); updateSearchIcon();
        }
    });

    // Сайдбар – обработчики тумблеров
    sidebarThemeToggle.addEventListener('change', () => {
        applyTheme(sidebarThemeToggle.checked);
    });
    sidebarTestModeToggle.addEventListener('change', () => {
        toggleTestMode(sidebarTestModeToggle.checked);
    });
    sidebarCorrectOnlyToggle.addEventListener('change', () => {
        correctOnly = sidebarCorrectOnlyToggle.checked;
        localStorage.setItem('eb-correct-only', correctOnly ? '1' : '0');
        if (!testMode) renderTicket(currentTicketIndex, searchQuery);
        updateSidebarUI();
    });
    sidebarCitationsToggle.addEventListener('change', () => {
        showCitations = sidebarCitationsToggle.checked;
        localStorage.setItem('eb-show-citations', showCitations ? '1' : '0');
        if (!testMode) {
            renderTicket(currentTicketIndex, searchQuery);
        } else if (testResults.style.display !== 'none') {
            // Перерисовываем результаты, но без повторного авто‑включения
            const ticket = testTicketData;
            let resultHTML = `
                <div class="results-card">
                    <h2 class="results-title">Результаты теста — ${ticket.id === '?' ? 'Случайные вопросы' : `Билет ${ticket.id}`}</h2>
                    <div class="results-stats">
                        <div class="stat correct" data-category="correct"><span class="stat-num">${testAnswers.filter(a => a && a.correct).length}</span> правильно</div>
                        <div class="stat wrong" data-category="wrong"><span class="stat-num">${testAnswers.filter(a => a && !a.correct).length}</span> неправильно</div>
                        <div class="stat unanswered" data-category="unanswered"><span class="stat-num">${testAnswers.filter(a => a === null).length}</span> без ответа</div>
                    </div>
                    <div class="results-details">
                        <h3>Детализация:</h3>
                        ${ticket.questions.map((q, i) => {
                            const ans = testAnswers[i];
                            let statusClass = 'unanswered', statusText = 'Нет ответа';
                            if (ans) { statusClass = ans.correct ? 'correct' : 'wrong'; statusText = ans.correct ? 'Правильно' : 'Неправильно'; }
                            return `
                                <div class="result-question" data-status="${statusClass}">
                                    <div class="result-status ${statusClass}">${statusText}</div>
                                    <div class="result-qtext">${q.text}</div>
                                    <ul class="result-options">
                                        ${q.options.map((opt, oi) => {
                                            let cls = '';
                                            if (opt.correct) cls = 'correct';
                                            else if (ans && ans.selected === oi && !ans.correct) cls = 'wrong';
                                            const marker = opt.correct ? '✓' : (ans && ans.selected === oi && !ans.correct ? '✗' : '');
                                            return `<li class="${cls}"><span class="option-marker">${marker}</span> ${opt.text}</li>`;
                                        }).join('')}
                                    </ul>
                                    ${showCitations && q.citation ? `<div class="citation-block" style="margin-top:0.75rem;"><div class="citation-title">Выдержка из нормативки</div><div class="citation-text">${escapeHTML(q.citation).replace(/\n/g, '<br>')}</div></div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="results-actions">
                        <button class="btn btn-accent" id="retryTestBtn-bottom">Пройти заново</button>
                        <button class="btn" id="newTicketBtnResult-bottom"><i class="fa-solid fa-shuffle"></i> Новый билет</button>
                        <button class="btn" id="exitTestBtn-bottom">Выйти из теста</button>
                    </div>
                </div>
            `;
            testResults.innerHTML = resultHTML;
            document.getElementById('retryTestBtn-bottom').addEventListener('click', () => startTest(testTicketIndex));
            document.getElementById('newTicketBtnResult-bottom').addEventListener('click', () => loadNextRandomTicket());
            document.getElementById('exitTestBtn-bottom').addEventListener('click', () => {
                sidebarTestModeToggle.checked = false;
                toggleTestMode(false);
            });
            document.getElementById('retryTestBtn').addEventListener('click', () => startTest(testTicketIndex));
            document.getElementById('newTicketBtnResult').addEventListener('click', () => loadNextRandomTicket());
            document.getElementById('exitTestBtn').addEventListener('click', () => {
                sidebarTestModeToggle.checked = false;
                toggleTestMode(false);
            });
            // восстанавливаем интерактивные карточки
            const statElements = document.querySelectorAll('.results-stats .stat');
            const allQuestions = document.querySelectorAll('.result-question');
            statElements.forEach(stat => {
                stat.style.cursor = 'pointer';
                stat.addEventListener('click', function () {
                    const category = this.dataset.category;
                    const isActive = this.classList.contains('active');
                    statElements.forEach(s => s.classList.remove('active'));
                    if (isActive) { allQuestions.forEach(q => q.style.display = ''); return; }
                    this.classList.add('active');
                    allQuestions.forEach(q => q.style.display = q.dataset.status === category ? '' : 'none');
                });
            });
        }
        updateSidebarUI();
    });

    sidebarSoundToggle.addEventListener('change', () => {
        soundEnabled = sidebarSoundToggle.checked;
        localStorage.setItem('eb-sound', soundEnabled ? '1' : '0');
        updateSidebarUI();
    });
    // sidebarShuffleToggle.addEventListener('change', () => {
    //     if (testMode) {
    //         if (isRandomMode) {
    //             startTest(0, { randomQuestions: true, questionCount: testAnswers.length });
    //         } else {
    //             startTest(testTicketIndex);
    //         }
    //     }
    //     updateSidebarUI();
    // });
    sidebarShuffleToggle.addEventListener('change', () => {
        const checked = sidebarShuffleToggle.checked;
        localStorage.setItem('eb-shuffle', checked ? '1' : '0');
        if (testMode) {
            if (isRandomMode) {
                startTest(0, { randomQuestions: true, questionCount: testAnswers.length });
            } else {
                startTest(testTicketIndex);
            }
        }
        updateSidebarUI();
    });
    // sidebarGridToggle.addEventListener('change', () => {
    //     questionGrid.style.display = sidebarGridToggle.checked ? 'flex' : 'none';
    //     if (sidebarGridToggle.checked) buildQuestionGrid();
    //     updateSidebarUI();
    // });
    sidebarGridToggle.addEventListener('change', () => {
        const checked = sidebarGridToggle.checked;
        localStorage.setItem('eb-grid', checked ? '1' : '0');
        questionGrid.style.display = checked ? 'flex' : 'none';
        if (checked) buildQuestionGrid();
        updateSidebarUI();
    });
    // sidebarAutoAdvanceToggle.addEventListener('change', () => {
    //     autoAdvance = sidebarAutoAdvanceToggle.checked;
    //     if (!autoAdvance && autoAdvanceTimeout) {
    //         clearTimeout(autoAdvanceTimeout);
    //         autoAdvanceTimeout = null;
    //     }
    //     updateSidebarUI();
    // });
    sidebarAutoAdvanceToggle.addEventListener('change', () => {
        autoAdvance = sidebarAutoAdvanceToggle.checked;
        localStorage.setItem('eb-auto-advance', autoAdvance ? '1' : '0');
        if (!autoAdvance && autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        updateSidebarUI();
    });

    // Бургер и оверлей
    burgerBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('show');
        updateSidebarUI();
    });
    function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Кнопки теста
    prevQuestionBtn.addEventListener('click', () => { if (testQuestionIndex > 0) { testQuestionIndex--; renderTestQuestion(); } });
    nextQuestionBtn.addEventListener('click', () => { if (testTicketData && testQuestionIndex < testTicketData.questions.length - 1) { testQuestionIndex++; renderTestQuestion(); } });
    finishTestBtn.addEventListener('click', finishTest);
    finishTestBtnBottom.addEventListener('click', finishTest);
    nextTicketBtn.addEventListener('click', loadNextRandomTicket);
    randomQuestionsBtn.addEventListener('click', () => {
        const num = prompt('Сколько вопросов (максимум 50)?', '20');
        const count = parseInt(num, 10);
        if (isNaN(count) || count < 1) return;
        startTest(0, { randomQuestions: true, questionCount: Math.min(count, 50) });
    });
    questionsList.addEventListener('click', handleTestOptionClick);

    // Клавиатура
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'Escape' && sidebar.classList.contains('open')) { closeSidebar(); return; }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (testMode) { if (testQuestionIndex > 0) { testQuestionIndex--; renderTestQuestion(); } }
            else { if (currentTicketIndex > 0) navigateToTicket(currentTicketIndex - 1, searchQuery); }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (testMode) { if (testTicketData && testQuestionIndex < testTicketData.questions.length - 1) { testQuestionIndex++; renderTestQuestion(); } }
            else { if (currentTicketIndex < TICKETS_DATA.length - 1) navigateToTicket(currentTicketIndex + 1, searchQuery); }
        } else if (e.key === 'f' && e.ctrlKey) { e.preventDefault(); searchInput.focus(); }
    });

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => scrollToTopBtn.classList.toggle('show', window.scrollY > 300));
        scrollToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    function init() {
        // const savedTheme = localStorage.getItem('eb-theme');
        // if (savedTheme === 'dark') applyTheme(true);
        // else if (savedTheme === 'light') applyTheme(false);
        // else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
        // correctOnly = localStorage.getItem('eb-correct-only') === '1';
        // showCitations = localStorage.getItem('eb-show-citations') === '1';
        // soundEnabled = localStorage.getItem('eb-sound') === '1';
        correctOnly = localStorage.getItem('eb-correct-only') === '1';

        // Выдержки из нормативки: по умолчанию ВКЛ
        if (localStorage.getItem('eb-show-citations') === null) {
            showCitations = true;
            localStorage.setItem('eb-show-citations', '1');
        } else {
            showCitations = localStorage.getItem('eb-show-citations') === '1';
        }

        // Звук: по умолчанию ВКЛ
        if (localStorage.getItem('eb-sound') === null) {
            soundEnabled = true;
            localStorage.setItem('eb-sound', '1');
        } else {
            soundEnabled = localStorage.getItem('eb-sound') === '1';
        }

        // Перемешивание вопросов: по умолчанию ВКЛ
        if (localStorage.getItem('eb-shuffle') === null) {
            localStorage.setItem('eb-shuffle', '1');
        }
        const shuffleEnabled = localStorage.getItem('eb-shuffle') === '1';
        if (sidebarShuffleToggle) sidebarShuffleToggle.checked = shuffleEnabled;

        // Сетка вопросов: по умолчанию ВКЛ
        if (localStorage.getItem('eb-grid') === null) {
            localStorage.setItem('eb-grid', '1');
        }
        const gridEnabled = localStorage.getItem('eb-grid') === '1';
        if (sidebarGridToggle) sidebarGridToggle.checked = gridEnabled;

        // Автопереход: по умолчанию ВКЛ
        if (localStorage.getItem('eb-auto-advance') === null) {
            localStorage.setItem('eb-auto-advance', '1');
            autoAdvance = true;
        } else {
            autoAdvance = localStorage.getItem('eb-auto-advance') === '1';
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
        updateSidebarUI();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('eb-theme')) applyTheme(e.matches);
        });
    }
    init();
    console.log('⚡ Приложение готово');
})();