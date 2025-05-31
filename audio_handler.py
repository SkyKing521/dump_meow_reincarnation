import pyaudio
import wave
import io
import asyncio
from typing import Dict, Optional
import subprocess
import tempfile
import os
import base64

class AudioHandler:
    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.streams = {}  # (channel_id, user_id) -> stream
        self.audio_format = pyaudio.paInt16
        self.channels = 1  # Mono
        self.rate = 48000  # Совпадает с фронтом
        self.chunk = 1024
        self._check_audio_devices()

    def _check_audio_devices(self):
        """Проверка наличия аудио устройств"""
        input_devices = []
        output_devices = []
        
        for i in range(self.p.get_device_count()):
            device_info = self.p.get_device_info_by_index(i)
            if device_info.get('maxInputChannels') > 0:
                input_devices.append(device_info)
            if device_info.get('maxOutputChannels') > 0:
                output_devices.append(device_info)
        
        if not input_devices:
            raise RuntimeError("No input devices found")
        if not output_devices:
            raise RuntimeError("No output devices found")

    def create_input_stream(self, stream_id) -> Optional[pyaudio.Stream]:
        try:
            # Проверяем, не существует ли уже поток
            if stream_id in self.streams:
                self.close_stream(stream_id)
            
            stream = self.p.open(
                format=self.audio_format,
                channels=self.channels,
                rate=self.rate,
                input=True,
                frames_per_buffer=self.chunk,
                input_device_index=None  # Используем устройство по умолчанию
            )
            self.streams[stream_id] = stream
            return stream
        except Exception as e:
            print(f"Error creating input stream: {e}")
            return None

    def create_output_stream(self, stream_id) -> Optional[pyaudio.Stream]:
        try:
            # Проверяем, не существует ли уже поток
            if stream_id in self.streams:
                self.close_stream(stream_id)
            
            stream = self.p.open(
                format=self.audio_format,
                channels=self.channels,
                rate=self.rate,
                output=True,
                frames_per_buffer=self.chunk,
                output_device_index=None  # Используем устройство по умолчанию
            )
            self.streams[stream_id] = stream
            return stream
        except Exception as e:
            print(f"Error creating output stream: {e}")
            return None

    def process_audio(self, audio_data: bytes) -> bytes:
        try:
            # Если данные уже в формате base64, декодируем их
            if isinstance(audio_data, str):
                try:
                    audio_data = base64.b64decode(audio_data)
                except:
                    pass

            # Создаем временный файл для WebM
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as webm_file:
                webm_file.write(audio_data)
                webm_path = webm_file.name

            # Создаем временный файл для PCM
            pcm_path = webm_path + '.pcm'

            try:
                # Конвертируем WebM в PCM используя ffmpeg
                subprocess.run([
                    'ffmpeg', '-i', webm_path,
                    '-f', 's16le',  # 16-bit PCM
                    '-ar', str(self.rate),  # Sample rate
                    '-ac', str(self.channels),  # Channels
                    pcm_path
                ], check=True, capture_output=True)

                # Читаем PCM данные
                with open(pcm_path, 'rb') as pcm_file:
                    pcm_data = pcm_file.read()

                return pcm_data

            finally:
                # Удаляем временные файлы
                try:
                    os.unlink(webm_path)
                    os.unlink(pcm_path)
                except:
                    pass

        except Exception as e:
            print(f"Error processing audio: {e}")
            return b''

    def play_audio(self, stream_id, audio_data: bytes):
        try:
            if stream_id in self.streams:
                stream = self.streams[stream_id]
                processed_data = self.process_audio(audio_data)
                if processed_data:
                    # Проверяем, что поток активен
                    if not stream.is_active():
                        stream.start_stream()
                    stream.write(processed_data)
        except Exception as e:
            print(f"Error playing audio: {e}")

    def close_stream(self, stream_id):
        if stream_id in self.streams:
            try:
                stream = self.streams[stream_id]
                if stream.is_active():
                    stream.stop_stream()
                stream.close()
                del self.streams[stream_id]
            except Exception as e:
                print(f"Error closing stream: {e}")

    def cleanup(self):
        for stream_id in list(self.streams.keys()):
            self.close_stream(stream_id)
        self.p.terminate()

# Create a global instance
audio_handler = AudioHandler()