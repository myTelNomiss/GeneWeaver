from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import datetime
from contextlib import closing

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'maize_genes.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/search', methods=['POST'])
def api_search():
    search_term = request.json.get('q', '').strip()
    if not search_term:
        return jsonify({"error": "请输入有效搜索词"}), 400

    try:
        with get_db() as conn:
            # 解析搜索条件
            conditions = []
            params = []

            # 1. 关键词映射查询
            keyword_conditions = conn.execute('''
                SELECT search_condition, target_field 
                FROM keyword_mappings 
                WHERE keyword = ?
            ''', (search_term,)).fetchall()

            for row in keyword_conditions:
                if row['target_field'] == 'function':
                    conditions.append(f"f.function_name = ?")
                    params.append(row['search_condition'])
                elif row['target_field'] == 'gene_status':
                    conditions.append(row['search_condition'])

            # 2. 基因名直接匹配
            if not keyword_conditions:
                conditions.append("g.gene_name LIKE ?")
                params.append(f"%{search_term}%")

            # 构建最终查询
            base_query = '''
                SELECT 
                    g.gene_name as name,
                    g.is_verified as verified,
                    GROUP_CONCAT(f.function_name, '; ') as functions,
                    g.description
                FROM genes g
                LEFT JOIN gene_functions gf ON g.id = gf.gene_id
                LEFT JOIN functions f ON gf.function_id = f.id
                {where}
                GROUP BY g.id
                ORDER BY g.is_verified DESC, g.gene_name
            '''.format(
                where=f"WHERE {' OR '.join(conditions)}" if conditions else ""
            )

            cursor = conn.execute(base_query, params)
            results = [dict(row) for row in cursor]

            return jsonify({"results": results})

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/gene/<name>')
def gene_detail(name):
    try:
        with get_db() as conn:
            cursor = conn.execute('''
                SELECT 
                    gene_name as name,
                    is_verified as verified,
                    description,
                    created_at
                FROM genes 
                WHERE gene_name = ?
            ''', (name,))

            if row := cursor.fetchone():
                return jsonify({
                    "name": row["name"],
                    "verified": bool(row["verified"]),
                    "description": row["description"] or "暂无描述",
                    "created_at": row["created_at"]
                })
            return jsonify({"error": "未找到基因"}), 404

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)