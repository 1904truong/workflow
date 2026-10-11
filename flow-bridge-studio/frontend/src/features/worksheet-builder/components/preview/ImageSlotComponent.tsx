import type { ImageSlot } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface ImageSlotComponentProps {
  slot: ImageSlot;
  showEmptyPlaceholders?: boolean;
}

export const ImageSlotComponent: React.FC<ImageSlotComponentProps> = ({
  slot,
  showEmptyPlaceholders = true,
}) => {
  const hasImage = slot.status === 'assigned' && Boolean(slot.assetUrl);

  // If slot is empty and user chose not to print empty boxes, return blank space or minimal placeholder
  if (!hasImage && !showEmptyPlaceholders) {
    return null;
  }

  return (
    <div 
      className="flex flex-col items-center justify-center my-[2mm]"
      style={{ width: `${slot.widthMm}mm` }}
    >
      <div
        className="w-full relative flex items-center justify-center overflow-hidden bg-white"
        style={{
          width: `${slot.widthMm}mm`,
          height: `${slot.heightMm}mm`,
          border: hasImage ? 'none' : PRINT_TOKENS.borders.imagePlaceholder,
        }}
      >
        {hasImage ? (
          <img
            src={slot.assetUrl}
            alt={slot.caption || `Slot ${slot.label || slot.slotId}`}
            className="w-full h-full"
            style={{
              objectFit: slot.fitMode || 'contain',
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-2 text-[#888888]">
            <div className="text-[12pt] font-bold text-[#aaaaaa]">
              {slot.label ? `[ Image ${slot.label} ]` : `[ Image Slot ]`}
            </div>
            <div className="text-[7.5pt] text-[#aaaaaa] mt-1">
              {slot.widthMm} × {slot.heightMm} mm ({slot.aspectRatio})
            </div>
          </div>
        )}

        {/* Slot Label Badge (A, B, C...) */}
        {slot.label && (
          <span 
            className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/75 text-white font-bold text-[8pt] rounded"
            style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}
          >
            {slot.label}
          </span>
        )}
      </div>

      {/* Optional Caption */}
      {slot.caption && (
        <span 
          className="text-center font-bold text-[10pt] text-[#222222] mt-[1.5mm]"
          style={{ fontFamily: PRINT_TOKENS.typography.fontFamily }}
        >
          {slot.caption}
        </span>
      )}
    </div>
  );
};
