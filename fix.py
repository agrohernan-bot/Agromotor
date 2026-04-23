import re

with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

start = content.find('<div style="margin-bottom:0;display:flex;align-items:flex-end;padding-bottom:2px">')
if start == -1:
    start = content.find('<div style="margin-bottom:0;display:flex;align-items:flex-end;padding-bottom:2px;gap:.5rem">')

if start != -1:
    end = content.find('</div>', start) + 6
    new_content = '''          <div style="margin-bottom:0;display:flex;align-items:flex-end;padding-bottom:2px;gap:.5rem">
            <button class="btn btn-p" onclick="amCrearLoteGlobal()" style="height:42px;white-space:nowrap;background:linear-gradient(135deg,#1A3A6C,#2A5A8C);border:none">
              ➕ Crear Nuevo Lote
            </button>
            <button class="btn btn-s" onclick="amEliminarLoteGlobal()" style="height:42px;width:42px;padding:0;display:flex;align-items:center;justify-content:center;color:#C94A2A;border-color:rgba(201,74,42,.3);background:rgba(201,74,42,.05)" title="Eliminar Lote Actual">
              🗑️
            </button>
          </div>'''
    content = content[:start] + new_content + content[end:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed html!")
else:
    print("Pattern not found!")
