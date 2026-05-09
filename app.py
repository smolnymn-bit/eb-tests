import json
import re
from pathlib import Path
from flask import Flask, render_template, jsonify, send_from_directory, Response

app = Flask(__name__)

# ========== ЧТЕНИЕ ФАЙЛА С БИЛЕТАМИ ==========
TICKETS_FILE = Path(__file__).parent / "ЭБ Билеты 1-29.txt"  # или укажите свой путь

def load_raw_text(filepath: Path) -> str:
    """Читает содержимое txt-файла с вопросами."""
    if not filepath.exists():
        raise FileNotFoundError(
            f"Файл с билетами не найден: {filepath}\n"
            "Положите 'ЭБ Билеты 1-29.txt' в папку с app.py"
        )
    return filepath.read_text(encoding="utf-8")

# Загружаем текст при старте
RAW_TEXT = load_raw_text(TICKETS_FILE)

# ========== ПАРСИНГ (тот же самый, что и раньше) ==========
def parse_tickets(raw_text: str) -> list:
    """Парсит текст со всеми билетами и возвращает список словарей."""
    tickets = []
    ticket_blocks = re.split(r'\n(?=БИЛЕТ\s+\d+|Билет\s+\d+)', raw_text.strip())

    for block in ticket_blocks:
        if not block.strip():
            continue

        ticket_match = re.match(r'(?:БИЛЕТ|Билет)\s+(\d+)', block.strip())
        if not ticket_match:
            continue
        ticket_id = int(ticket_match.group(1))

        body = block.strip()
        body = re.sub(r'^(?:БИЛЕТ|Билет)\s+\d+\s*', '', body).strip()
        question_blocks = re.split(r'\n(?=\d+\.\s)', body)

        questions = []
        for q_block in question_blocks:
            q_block = q_block.strip()
            if not q_block:
                continue

            lines = q_block.split('\n')
            first_line = lines[0].strip()
            q_text = re.sub(r'^\d+\.\s*', '', first_line).strip()

            options = []
            for line in lines[1:]:
                line = line.strip()
                if not line:
                    continue
                # option_match = re.match(r'^[-•]\s*(✅?\s*)\[?\s*\]?\s*(.*)', line)
                option_match = re.match(r'\s*[-•]\s*(✅?\s*)\[?\s*\]?\s*(.*)', line)
                if option_match:
                    marker = option_match.group(1).strip()
                    text = option_match.group(2).strip()
                    is_correct = '✅' in marker or '✅' in line[:5]
                    options.append({
                        "text": text,
                        "correct": is_correct
                    })

            # Ищем выдержку из нормативки после вариантов ответа
            citation = None
            for i, line in enumerate(lines):
                if line.strip().lower().startswith('выдержка из нормативки'):
                    cite_lines = [l.strip() for l in lines[i+1:] if l.strip()]
                    if cite_lines:
                        citation = '\n'.join(cite_lines)
                    break
            if citation:
                print(f"✅ Найдена выдержка для вопроса: {q_text[:60]}...")
            else:
                print(f"❌ Нет выдержки для вопроса: {q_text[:60]}...")

            if q_text and options:
                questions.append({
                    "text": q_text,
                    "options": options,
                    "citation": citation
                })

        if questions:
            tickets.append({
                "id": ticket_id,
                "questions": questions
            })

    tickets.sort(key=lambda t: t['id'])
    return tickets

TICKETS = parse_tickets(RAW_TEXT)

# ========== МАРШРУТЫ ==========
@app.route('/')
def index():
    return render_template('index.html', tickets_json=json.dumps(TICKETS, ensure_ascii=False))

@app.route('/api/tickets')
def api_tickets():
    return jsonify(TICKETS)

@app.route('/api/tickets/<int:ticket_id>')
def api_ticket(ticket_id):
    ticket = next((t for t in TICKETS if t['id'] == ticket_id), None)
    if ticket:
        return jsonify(ticket)
    return jsonify({"error": "Билет не найден"}), 404

# Специальный маршрут для sw.js с нужным заголовком
@app.route('/sw.js')
def service_worker():
    response = send_from_directory('static', 'sw.js')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache'
    return response

if __name__ == '__main__':
    print(f"✅ Загружено билетов: {len(TICKETS)}")
    print(f"✅ Всего вопросов: {sum(len(t['questions']) for t in TICKETS)}")
    print("🚀 Сервер запущен: http://127.0.0.1:52026")
    app.run(debug=True, host='0.0.0.0', port=52026)