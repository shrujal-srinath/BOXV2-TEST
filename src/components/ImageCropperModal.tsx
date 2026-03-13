import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';

interface Props {
    imageSrc: string;
    onCancel: () => void;
    onCropComplete: (croppedImageBase64: string) => void;
}

export const ImageCropperModal: React.FC<Props> = ({ imageSrc, onCancel, onCropComplete }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback((_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-lg h-[400px] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1} // Force square for logos
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteHandler}
                    onZoomChange={onZoomChange}
                    cropShape="round" // Circular mask guide
                    showGrid={false}
                />
            </div>

            <div className="w-full max-w-lg mt-4 flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-zinc-500 uppercase">Zoom</span>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-yellow-500"
                />
            </div>

            <div className="flex gap-4 mt-6 w-full max-w-lg">
                <button onClick={onCancel} className="flex-1 py-3 bg-zinc-800 rounded-lg font-bold text-zinc-400 uppercase text-xs hover:bg-zinc-700 transition-colors">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-3 bg-green-600 rounded-lg font-bold text-white uppercase text-xs hover:bg-green-500 shadow-lg shadow-green-900/20 transition-colors">Crop & Save</button>
            </div>
        </div>
    );
};