import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, IconButton } from '@mui/material';
import { AttachFile, Image, VideoLibrary, MusicNote } from '@mui/icons-material';

const MediaUpload = ({ onFileUpload }) => {
  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        onFileUpload({
          id: crypto.randomUUID(),
          type: file.type.startsWith('image/') ? 'image' : 
                file.type.startsWith('video/') ? 'video' : 'audio',
          url: reader.result,
          name: file.name,
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    });
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'video/*': ['.mp4', '.webm'],
      'audio/*': ['.mp3', '.wav']
    }
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: '2px dashed #ccc',
        borderRadius: 2,
        p: 2,
        textAlign: 'center',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover'
        }
      }}
    >
      <input {...getInputProps()} />
      <IconButton color="primary">
        <AttachFile />
      </IconButton>
      <Typography variant="body2" color="textSecondary">
        {isDragActive
          ? 'Отпустите файл здесь'
          : 'Перетащите файл сюда или нажмите для выбора'}
      </Typography>
    </Box>
  );
};

export default MediaUpload; 