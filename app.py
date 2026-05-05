import json
import re
from pathlib import Path
from flask import Flask, render_template, jsonify, send_from_directory
import os

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

            if q_text and options:
                questions.append({
                    "text": q_text,
                    "options": options
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

@app.route('/sw.js')
def service_worker():
    """Отдаём Service Worker из корня проекта с правильными заголовками"""
    response = send_from_directory('.', 'sw.js')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Content-Type'] = 'application/javascript'
    return response
    
if __name__ == '__main__':
    print(f"✅ Загружено билетов: {len(TICKETS)}")
    print(f"✅ Всего вопросов: {sum(len(t['questions']) for t in TICKETS)}")
    port = int(os.environ.get("PORT", 52026))
    app.run(host='0.0.0.0', port=port, debug=False)
