import { CheckCircle2 } from "lucide-react";

// Sub-project B2 (kotklusser-cleanup-plan.md sectie 3.4, zie
// docs/superpowers/specs/2026-07-21-ticket-detail-shared-subcomponents-design.md):
// canonieke stepper-look overgenomen uit AannemerKlusDetail.jsx (ronde
// cirkels + vinkjes + verbindingslijn), nu gedeeld door TicketDetail.jsx en
// AannemerKlusDetail.jsx. STATUS_ORDER/STATUS_LABELS zijn hier de ene bron
// van waarheid voor beide pagina's (niet enkel de visuele schil).

export const STATUS_ORDER = ["sent", "received", "in_progress", "resolved"];

export const STATUS_LABELS = {
  sent: "Verstuurd",
  received: "Ontvangen",
  in_progress: "In Behandeling",
  resolved: "Opgelost",
};

const TicketStatusStepper = ({ status }) => {
  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Status</p>
      <div className="flex items-center gap-0">
        {STATUS_ORDER.map((step, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                    active
                      ? "border-indigo-500 bg-indigo-500/20"
                      : done
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-white/15 bg-transparent"
                  }`}
                >
                  {done && !active && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  {active && <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />}
                </div>
                <span
                  className={`text-xs mt-1.5 text-center leading-tight max-w-[60px] ${
                    active ? "text-indigo-400 font-medium" : done ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {STATUS_LABELS[step]}
                </span>
              </div>
              {i < STATUS_ORDER.length - 1 && (
                <div className={`flex-1 h-0.5 mb-5 mx-1 rounded ${i < currentIdx ? "bg-indigo-500" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketStatusStepper;
