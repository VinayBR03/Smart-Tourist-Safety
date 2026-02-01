import os
import json
import sys

def path_to_dict(path):
    """
    Recursively traverse directory and build a dictionary 
    representation of the file structure.
    """
    # Initialize dictionary for the current path
    d = {'name': os.path.basename(path)}
    
    # Check if the path is a directory or a file
    if os.path.isdir(path):
        d['type'] = "directory"
        children = []
        # Iterate over contents of the directory
        for entry in os.listdir(path):
            if entry == "node_modules":
                continue
            full_path = os.path.join(path, entry)
            # Recursively call function for subdirectories/files
            children.append(path_to_dict(full_path))
        d['children'] = children
    else:
        d['type'] = "file"
    
    return d

# Specify the starting directory path. 
# It uses the current directory ('.') by default or an argument from the command line.
if __name__ == '__main__':
    try:
        directory = sys.argv[1]
    except IndexError:
        directory = "C:\\Users\\Vinay B R\\Desktop\\Smart Tourist Safety System\\frontend\\TouristSafetyApp"

    # Generate the dictionary representation
    folder_structure = path_to_dict(directory)
    
    # Convert the dictionary to a JSON formatted string with indentation for readability
    json_output = json.dumps(folder_structure, indent=4)
    
    # Print the JSON output
    print(json_output)

    # Optionally, write the JSON output to a file
    with open('folder_structure.json', 'w') as json_file:
        json_file.write(json_output)