import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Box, Button, IconButton, TextField, Paper } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const LOCALSTORAGE_KEY = 'gif_widgets_v2';
const DB_NAME = 'GifWidgetsDB';
const DB_STORE = 'gifs';

// --- IndexedDB helpers ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(id, blob) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}
function idbGet(id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}
function idbDelete(id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function GifWidgetsBoard() {
  const [widgets, setWidgets] = useState([]);
  const [newGifUrl, setNewGifUrl] = useState('');
  const fileInputRef = useRef();

  // Загрузка из localStorage и IndexedDB при монтировании
  useEffect(() => {
    const load = async () => {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY);
      if (saved) {
        try {
          const arr = JSON.parse(saved);
          // Для файлов — получить blob из IndexedDB и сделать objectURL
          const widgetsWithFiles = await Promise.all(arr.map(async w => {
            if (w.type === 'file') {
              const blob = await idbGet(w.fileId);
              if (blob) {
                return { ...w, gifUrl: URL.createObjectURL(blob) };
              } else {
                return null; // файл не найден
              }
            } else {
              return w;
            }
          }));
          setWidgets(widgetsWithFiles.filter(Boolean));
        } catch {}
      }
    };
    load();
    // cleanup objectURLs
    return () => {
      widgets.forEach(w => {
        if (w.type === 'file' && w.gifUrl) URL.revokeObjectURL(w.gifUrl);
      });
    };
    // eslint-disable-next-line
  }, []);

  // Сохранение в localStorage при изменении
  useEffect(() => {
    // Сохраняем только метаданные (без gifUrl для файлов)
    const meta = widgets.map(w => w.type === 'file'
      ? { id: w.id, type: 'file', fileId: w.fileId, x: w.x, y: w.y, width: w.width, height: w.height }
      : { id: w.id, type: 'url', gifUrl: w.gifUrl, x: w.x, y: w.y, width: w.width, height: w.height }
    );
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(meta));
  }, [widgets]);

  const addWidget = (gifUrl) => {
    setWidgets([
      ...widgets,
      {
        id: Date.now() + Math.random(),
        type: 'url',
        gifUrl,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: 200,
        height: 200,
      },
    ]);
    setNewGifUrl('');
  };

  const addWidgetFromFile = (file) => {
    if (!file) return;
    const id = 'file_' + Date.now() + '_' + Math.random();
    idbPut(id, file).then(() => {
      setWidgets(widgets => ([
        ...widgets,
        {
          id: Date.now() + Math.random(),
          type: 'file',
          fileId: id,
          gifUrl: URL.createObjectURL(file),
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          width: 200,
          height: 200,
        },
      ]));
    });
  };

  const updateWidget = (id, data) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...data } : w));
  };

  const removeWidget = (id) => {
    setWidgets(widgets => {
      const w = widgets.find(w => w.id === id);
      if (w && w.type === 'file' && w.fileId) {
        idbDelete(w.fileId);
        if (w.gifUrl) URL.revokeObjectURL(w.gifUrl);
      }
      return widgets.filter(w => w.id !== id);
    });
  };

  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 1200 }}>
      {/* Панель добавления */}
      <Paper elevation={3} sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1300, p: 2, display: 'flex', gap: 1, alignItems: 'center', pointerEvents: 'auto' }}>
        <TextField
          size="small"
          label="GIF URL"
          value={newGifUrl}
          onChange={e => setNewGifUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newGifUrl) addWidget(newGifUrl); }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => newGifUrl && addWidget(newGifUrl)}
          disabled={!newGifUrl}
        >
          Добавить
        </Button>
        <input
          type="file"
          accept="image/gif"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              addWidgetFromFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          Загрузить GIF
        </Button>
      </Paper>
      {/* Виджеты */}
      {widgets.map(widget => (
        <Rnd
          key={widget.id}
          size={{ width: widget.width, height: widget.height }}
          position={{ x: widget.x, y: widget.y }}
          onDragStop={(e, d) => updateWidget(widget.id, { x: d.x, y: d.y })}
          onResizeStop={(e, direction, ref, delta, position) =>
            updateWidget(widget.id, {
              width: parseInt(ref.style.width),
              height: parseInt(ref.style.height),
              ...position,
            })
          }
          bounds="parent"
          style={{ zIndex: 1250, pointerEvents: 'auto' }}
        >
          <Paper elevation={6} sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
            <IconButton
              size="small"
              onClick={() => removeWidget(widget.id)}
              sx={{ position: 'absolute', top: 2, right: 2, zIndex: 2, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'red' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
            {widget.gifUrl ? (
              <img
                src={widget.gifUrl}
                alt="gif"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
                draggable={false}
              />
            ) : (
              <Box sx={{ color: 'gray' }}>Нет гифки</Box>
            )}
          </Paper>
        </Rnd>
      ))}
    </Box>
  );
}

export default GifWidgetsBoard; 