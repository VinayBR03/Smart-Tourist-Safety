import os
import json

def get_structure(path):
    """Builds the structure, skipping '_' prefixes and specific names like 'venv'."""
    name = os.path.basename(path)
    
    if os.path.isdir(path):
        # Filter: Skip if starts with '_' OR if the name is 'venv' or '.git'
        exclude = {'venv', '.git', '.vscode'}
        items = [x for x in os.listdir(path) if not x.startswith('_') and x not in exclude]
        items.sort() 
        
        return {
            name: [get_structure(os.path.join(path, x)) for x in items]
        }
    return name

def save_structure_to_json(root_path, output_file):
    """Saves the filtered folder structure to a formatted JSON file."""
    # os.path.abspath ensures the root folder name isn't just '.'
    root_name = os.path.abspath(root_path)
    structure = get_structure(root_name)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(structure, f, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    save_structure_to_json('.', 'folder_structure.json')
    print("Clean JSON structure generated!")
