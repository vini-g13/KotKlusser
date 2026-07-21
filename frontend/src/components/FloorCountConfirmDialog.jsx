import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

const FloorCountConfirmDialog = ({ open, onCancel, onConfirm }) => (
  <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
    <DialogContent className="bg-[#161425] border-white/10">
      <DialogHeader>
        <DialogTitle className="text-white">Bevestiging aantal verdiepingen</DialogTitle>
      </DialogHeader>
      <p className="text-slate-300 py-2">
        Uw pand heeft enkel een gelijkvloers, zonder extra verdiepingen. Klopt dit?
      </p>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} className="border-white/10 text-white">
          Nee, aanpassen
        </Button>
        <Button onClick={onConfirm} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="confirm-floor-zero">
          Ja, bevestigen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default FloorCountConfirmDialog;
