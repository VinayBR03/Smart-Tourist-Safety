import os
import zipfile

def zip_folder(folder_path, output_zip):
    """
    Compresses a folder into a ZIP file, excluding 'node_modules'.
    """
    # Use ZIP_DEFLATED for actual compression
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            # Prune 'node_modules' and '.git' so os.walk skips them
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
            if '.git' in dirs:
                dirs.remove('.git')
            if '.pio' in dirs:
                dirs.remove('.pio')
            if '.env' in dirs:
                dirs.remove('.env')
            if 'google-services.json' in dirs:
                dirs.remove('google-services.json')
            if 'tests' in dirs:
                dirs.remove('tests')
            if 'venv' and 'venv_linux' in dirs:
                dirs.remove('venv')
                dirs.remove('venv_linux')


            for file in files:
                # Build absolute file path
                file_path = os.path.join(root, file)
                
                # Create a relative path for the file inside the ZIP
                # This ensures the ZIP doesn't contain absolute paths from your C: or / root
                arcname = os.path.relpath(file_path, folder_path)
                
                zipf.write(file_path, arcname)
    print(f"Compressed: {folder_path} -> {output_zip}")

# Usage
folder = input("Enter the folder path to compress (e.g., './sentineltour'): ")
output_zip = input("Enter the output ZIP file name (e.g., 'sentineltour-app.zip'): ")
zip_folder(folder, output_zip)
