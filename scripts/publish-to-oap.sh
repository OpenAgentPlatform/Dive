#!/bin/bash

# Get S3 credentials and domain from environment variables
S3KEY="${S3_ACCESS_KEY}"
S3SECRET="${S3_SECRET_KEY}"
S3_DOMAIN="${S3_DOMAIN}"

# Check if environment variables are set
if [ -z "$S3KEY" ] || [ -z "$S3SECRET" ] || [ -z "$S3_DOMAIN" ]; then
  echo "Error: S3 configuration not found in environment variables"
  echo "Please set S3_ACCESS_KEY, S3_SECRET_KEY, and S3_DOMAIN environment variables"
  exit 1
fi

function putS3
{
  local source_file_path=$1
  local upload_filename=$2
  bucket="oap-releases"
  local max_retries=3
  local retry_delay=30

  for attempt in $(seq 1 $max_retries); do
    date=`date -R`
    content_type="application/x-compressed-tar"
    string="PUT\n\n$content_type\n$date\n/$bucket/$upload_filename"
    signature=$(echo -en "${string}" | openssl sha1 -hmac "${S3SECRET}" -binary | base64)
    url="https://$S3_DOMAIN/$bucket/$upload_filename"

    echo "Upload attempt $attempt of $max_retries for $upload_filename"

    if curl -X PUT -T "$source_file_path" \
      -H "Host: $S3_DOMAIN" \
      -H "Date: $date" \
      -H "Content-Type: $content_type" \
      -H "Authorization: AWS ${S3KEY}:$signature" \
      "$url"; then
      echo "Upload successful for $upload_filename"
      return 0
    else
      if [ $attempt -lt $max_retries ]; then
        echo "Upload failed for $upload_filename. Retrying in $retry_delay seconds..."
        sleep $retry_delay
      else
        echo "Upload failed for $upload_filename after $max_retries attempts"
        return 1
      fi
    fi
  done
}

# Check if mode parameter is provided
if [ $# -eq 0 ]; then
  echo "Usage: $0 [electron|tauri]"
  echo "  electron: Upload files from ./release and ./output (if they exist)"
  echo "  tauri: Upload files from ./src-tauri/target/release/bundle"
  exit 1
fi

mode=$1

# Get script directory and set source path based on mode
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"

if [ "$mode" = "electron" ]; then
  source_paths=()
  if [ -d "$project_root/release" ]; then
    source_paths+=("$project_root/release")
  fi
  if [ -d "$project_root/output" ]; then
    source_paths+=("$project_root/output")
  fi
  if [ ${#source_paths[@]} -eq 0 ]; then
    echo "Error: No valid source directories found for electron mode"
    echo "Expected at least one of: $project_root/release, $project_root/output"
    exit 1
  fi
elif [ "$mode" = "tauri" ]; then
  source_paths=()
  if [ -d "$project_root/src-tauri/target/release/bundle" ]; then
    source_paths+=("$project_root/src-tauri/target/release/bundle")
  fi
  if [ -d "$project_root/src-tauri/target/x86_64-apple-darwin/release/bundle" ]; then
    source_paths+=("$project_root/src-tauri/target/x86_64-apple-darwin/release/bundle")
  fi
  if [ -d "$project_root/src-tauri/target/aarch64-apple-darwin/release/bundle" ]; then
    source_paths+=("$project_root/src-tauri/target/aarch64-apple-darwin/release/bundle")
  fi
  if [ ${#source_paths[@]} -eq 0 ]; then
    echo "Error: No valid source directories found for tauri mode"
    echo "Expected at least one of: $project_root/src-tauri/target/release/bundle, $project_root/src-tauri/target/x86_64-apple-darwin/release/bundle"
    exit 1
  fi
else
  echo "Error: Invalid mode. Use 'electron' or 'tauri'"
  exit 1
fi

echo "Mode: $mode"
echo "Source paths: ${source_paths[@]}"
echo "Looking for files with extensions: .exe, .AppImage, .dmg, .sig"
echo "Also looking for files starting with 'latest' and ending with .yml in: ${source_paths[@]}"
echo "Looking for files starting with 'latest' and ending with .json in: $project_root"

# Find and upload files with specific extensions (search up to 3 levels deep)
found_files=0

# Search for exe, AppImage, dmg, sig, and latest yml files in source_paths
for src_path in "${source_paths[@]}"; do
  while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      file_dir=$(dirname "$file")
      # Check if file has one of the target extensions and starts with dive/Dive
      if ([[ "$filename" == dive*.exe ]] || [[ "$filename" == Dive*.exe ]] \
          || [[ "$filename" == dive*.AppImage ]] || [[ "$filename" == Dive*.AppImage ]] \
          || [[ "$filename" == dive*.dmg ]] || [[ "$filename" == Dive*.dmg ]] \
          || [[ "$filename" == dive*.sig ]] || [[ "$filename" == Dive*.sig ]]); then
        echo "Uploading: $filename (from $file_dir)"
        putS3 "$file" "$filename"
        found_files=$((found_files + 1))
      # Handle latest yml files separately to modify URLs
      elif [[ "$filename" == latest*.yml ]]; then
        echo "Processing and uploading: $filename (from $file_dir)"

        # Create a temporary modified version of the yml file
        temp_file=$(mktemp)

        # Replace URLs in the YAML file to point to blob.oaphub.ai
        # Match lines like "url: filename" or "path: filename" and add the full URL
        # Handle both with and without leading spaces/dashes
        sed -E 's|^([[:space:]]*-?[[:space:]]*url: )([^h].*)|\1https://blob.oaphub.ai/\2|g; s|^([[:space:]]*path: )([^h].*)|\1https://blob.oaphub.ai/\2|g' "$file" > "$temp_file"

        cat "$temp_file"

        # Upload the modified temp file with the original filename
        putS3 "$temp_file" "$filename"

        # Clean up temp file
        rm -f "$temp_file"

        found_files=$((found_files + 1))
      fi
    fi
  done < <(find "$src_path" -maxdepth 3 -type f -print0)
done

# Search for latest json files in project_root (2 levels deep)
while IFS= read -r -d '' file; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    file_dir=$(dirname "$file")
    # Check if file matches latest json pattern
    if [[ "$filename" == latest*.json ]]; then
      echo "Processing and uploading: $filename (from $file_dir)"

      # Create a temporary modified version of the json file
      temp_file=$(mktemp)

      # Replace URLs in the JSON file to point to S3 bucket
      # Extract just the filename from the URL and replace the entire path
      sed -E 's|"url": "https?://[^"]+/([^/"]+)"|"url": "https://blob.oaphub.ai/\1"|g' "$file" > "$temp_file"

      # Upload the modified temp file with the original filename
      putS3 "$temp_file" "$filename"

      # Clean up temp file
      rm -f "$temp_file"

      found_files=$((found_files + 1))
    fi
  fi
done < <(find "$project_root" -maxdepth 2 -type f -print0)

if [ $found_files -eq 0 ]; then
  echo "No files with target extensions found in ${source_paths[@]}"
else
  echo "Uploaded $found_files files successfully"
fi