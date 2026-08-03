import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";

// Sub-project B2 (kotklusser-cleanup-plan.md sectie 3.4, zie
// docs/superpowers/specs/2026-07-21-ticket-detail-shared-subcomponents-design.md):
// canonieke fotogalerij overgenomen uit TicketDetail.jsx (klikbare thumbnails
// + Dialog-lightbox), nu ook gebruikt door AannemerKlusDetail.jsx — dat had
// voorheen enkel een statische, niet-klikbare grid.

const TicketPhotoGallery = ({ photos }) => {
  if (!photos?.length) return null;

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {photos.map((photo, idx) => (
          <Dialog key={idx}>
            <DialogTrigger asChild>
              <button className="shrink-0" data-testid={`photo-${idx}`}>
                <img
                  src={photo}
                  alt={`Foto ${idx + 1}`}
                  className="w-24 h-24 object-cover rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#161425] border-white/10 max-w-3xl">
              <DialogTitle className="sr-only">Foto {idx + 1}</DialogTitle>
              <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-auto rounded-lg" />
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
};

export default TicketPhotoGallery;
