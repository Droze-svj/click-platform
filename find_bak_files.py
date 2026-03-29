import os

def find_bak_files(directory):
    bak_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.bak'):
                bak_files.append(os.path.join(root, file))
    return bak_files

# Example usage
directory_path = '/path/to/directory'
bak_files = find_bak_files(directory_path)
for file in bak_files:
    print(file)
