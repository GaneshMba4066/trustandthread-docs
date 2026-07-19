import os
import glob
import markdown

# Directory Configuration
CONTENT_DIR = "content_source/"
OUTPUT_DIR = "blog/"
TEMPLATE_FILE = "base_template.html"

def load_template():
    with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
        return f.read()

def compile_platform_assets():
    print("[TTT_BUILD] Initializing static compilation sequence...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    template = load_template()

    source_files = glob.glob(os.path.join(CONTENT_DIR, "*.md"))
    for file_path in source_files:
        filename = os.path.basename(file_path)
        slug = filename.replace('.md', '')
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        title = lines[0].replace('#', '').strip() if lines else "Untitled"
        raw_markdown = "".join(lines[1:])
        html_content = markdown.markdown(raw_markdown, extensions=['fenced_code', 'tables'])
        final_payload = template.replace("{{TITLE_NODE}}", title)
        final_payload = final_payload.replace("{{CONTENT_INJECTION_NODE}}", html_content)
        output_path = os.path.join(OUTPUT_DIR, f"{slug}.html")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_payload)
        print(f"[COMPILED] Successfully built node: {output_path}")

if __name__ == "__main__":
    compile_platform_assets()
