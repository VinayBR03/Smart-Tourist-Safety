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

            for file in files:
                # Build absolute file path
                file_path = os.path.join(root, file)
                
                # Create a relative path for the file inside the ZIP
                # This ensures the ZIP doesn't contain absolute paths from your C: or / root
                arcname = os.path.relpath(file_path, folder_path)
                
                zipf.write(file_path, arcname)

# Usage
zip_folder('../backend/app', 'backend.zip')
