#!/usr/bin/env python3
"""
Script to add Authorization header support to all API calls
"""

import re
from pathlib import Path

def add_apiFetch_to_apiBase():
    """Add apiFetch function to src/lib/apiBase.ts"""
    file_path = Path("src/lib/apiBase.ts")
    content = file_path.read_text()

    apiFetch_code = '''
/**
 * Helper function to make authenticated API requests
 * Automatically adds the Authorization header with the token from localStorage
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);

  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Merge headers
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Always include credentials for cookies
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  return fetch(url, fetchOptions);
}
'''

    # Add before "export default apiUrl;"
    content = content.replace(
        '\nexport default apiUrl;',
        apiFetch_code + '\nexport default apiUrl;'
    )

    file_path.write_text(content)
    print(f"✅ Updated {file_path}")

def update_file_with_apiFetch(file_path: Path):
    """Update a single file to use apiFetch"""
    content = file_path.read_text()
    original = content

    # Check if file uses fetch(apiUrl(
    if 'fetch(apiUrl(' not in content and 'fetch(api' not in content:
        return False

    # Add apiFetch to imports from apiBase
    # Pattern 1: import { apiUrl } from ...
    content = re.sub(
        r'import\s*{\s*apiUrl\s*}\s*from\s*(["\'])([^"\']*apiBase[^"\']*)(["\'])',
        r'import { apiUrl, apiFetch } from \1\2\3',
        content
    )

    # Pattern 2: import { API_BASE, apiUrl } from ...
    content = re.sub(
        r'import\s*{\s*API_BASE,\s*apiUrl\s*}\s*from\s*(["\'])([^"\']*apiBase[^"\']*)(["\'])',
        r'import { API_BASE, apiUrl, apiFetch } from \1\2\3',
        content
    )

    # Replace fetch(apiUrl("/path"), { credentials: "include" }) with apiFetch("/path")
    content = re.sub(
        r'fetch\(apiUrl\(([^)]+)\),\s*{\s*credentials:\s*["\']include["\']\s*}\)',
        r'apiFetch(\1)',
        content
    )

    # Replace fetch(apiUrl("/path"), { with apiFetch("/path", {
    content = re.sub(
        r'fetch\(apiUrl\(([^)]+)\),\s*{',
        r'apiFetch(\1, {',
        content
    )

    # Replace remaining fetch(apiUrl("/path")) with apiFetch("/path")
    content = re.sub(
        r'fetch\(apiUrl\(([^)]+)\)\)',
        r'apiFetch(\1)',
        content
    )

    # Remove credentials: "include" from apiFetch calls (since it's already included)
    content = re.sub(
        r'apiFetch\(([^,]+),\s*{\s*credentials:\s*["\']include["\']\s*}\)',
        r'apiFetch(\1)',
        content
    )

    if content != original:
        file_path.write_text(content)
        print(f"✅ Updated {file_path}")
        return True
    return False

def main():
    # 1. Update apiBase.ts first
    add_apiFetch_to_apiBase()

    # 2. Find and update all TS/TSX files in src/
    src_dir = Path("src")
    updated_count = 0

    for file_path in src_dir.rglob("*.ts*"):
        if file_path.name.endswith(('.ts', '.tsx')):
            if update_file_with_apiFetch(file_path):
                updated_count += 1

    print(f"\n✅ Done! Updated {updated_count} files")

if __name__ == "__main__":
    main()
