import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const CustomAssetUploader = ({ onAssetUploaded, type = 'images' }) => {
  const { apiRequest } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const acceptedTypes = {
    images: 'image/*',
    music: 'audio/*',
    stickers: 'image/*'
  };

  const maxSizes = {
    images: 10 * 1024 * 1024, // 10MB
    music: 50 * 1024 * 1024,  // 50MB
    stickers: 5 * 1024 * 1024 // 5MB
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
  };

  const uploadFiles = async (files) => {
    // Validate files
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      if (!file.type.startsWith(type === 'music' ? 'audio/' : 'image/')) {
        errors.push(`${file.name}: Invalid file type`);
        continue;
      }

      if (file.size > maxSizes[type]) {
        errors.push(`${file.name}: File too large (max ${Math.round(maxSizes[type] / 1024 / 1024)}MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      alert('Upload errors:\n' + errors.join('\n'));
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();

      if (type === 'music') {
        formData.append('music', validFiles[0]);
        formData.append('options', JSON.stringify({ normalize: true }));
      } else {
        validFiles.forEach(file => {
          formData.append(type, file);
        });
      }

      const endpoint = type === 'music' ? '/video/manual-editing/upload-music' : '/video/manual-editing/upload-assets';

      const { data } = await apiRequest(endpoint, {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        setUploadProgress(100);
        if (onAssetUploaded) {
          onAssetUploaded(data.data);
        }

        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const getUploadIcon = () => {
    switch (type) {
      case 'images': return '🖼️';
      case 'music': return '🎵';
      case 'stickers': return '🏷️';
      default: return '📤';
    }
  };

  const getUploadText = () => {
    switch (type) {
      case 'images': return 'Upload Images';
      case 'music': return 'Upload Music';
      case 'stickers': return 'Upload Stickers';
      default: return 'Upload Files';
    }
  };

  const getFileTypeText = () => {
    switch (type) {
      case 'images': return 'PNG, JPG, GIF up to 10MB each';
      case 'music': return 'MP3, WAV, M4A up to 50MB';
      case 'stickers': return 'PNG, JPG up to 5MB each';
      default: return 'Supported files';
    }
  };

  return (
    <div className="custom-asset-uploader">
      <div
        className={`upload-zone ${dragActive ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={type !== 'music'}
          accept={acceptedTypes[type]}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <div className="upload-progress">
            <div className="progress-spinner"></div>
            <div className="progress-text">
              Uploading... {uploadProgress}%
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">{getUploadIcon()}</div>
            <div className="upload-text">
              <strong>{getUploadText()}</strong>
              <br />
              <small>{getFileTypeText()}</small>
            </div>
            <div className="upload-hint">
              Click to browse or drag & drop files here
            </div>
          </div>
        )}
      </div>

      {type === 'music' && (
        <div className="upload-options">
          <label>
            <input type="checkbox" defaultChecked />
            Auto-normalize audio levels
          </label>
          <label>
            <input type="checkbox" defaultChecked />
            Add fade in/out effects
          </label>
        </div>
      )}

      <div className="upload-tips">
        <h5>💡 Upload Tips:</h5>
        <ul>
          {type === 'images' && (
            <>
              <li>Use PNG for transparency, JPG for photos</li>
              <li>Images will be optimized for video overlay</li>
              <li>Maximum 10 images per upload</li>
            </>
          )}
          {type === 'music' && (
            <>
              <li>MP3 recommended for smaller file sizes</li>
              <li>Music will be auto-normalized</li>
              <li>Fade effects added automatically</li>
            </>
          )}
          {type === 'stickers' && (
            <>
              <li>Use PNG with transparent backgrounds</li>
              <li>Simple graphics work best as stickers</li>
              <li>Maximum 20 stickers per upload</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CustomAssetUploader;





