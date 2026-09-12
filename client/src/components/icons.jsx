/**
 * A small, hand-crafted icon set — deliberately not a generic icon
 * library. Stroke-based, consistent weight, sized to sit cleanly next to
 * Inter text. Every icon here earns its place; nothing decorative.
 */
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Icon({ size = 18, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      {children}
    </svg>
  );
}

export function ShieldIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </Icon>
  );
}

export function ShieldAlertIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12l5.5 5.5L20 6" />
    </Icon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5.5 8.5L12 15l6.5-6.5" />
    </Icon>
  );
}

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M8.5 6.5V5a1.5 1.5 0 011.5-1.5h4A1.5 1.5 0 0115.5 5v1.5" />
      <path d="M6.5 6.5l.8 12a1.5 1.5 0 001.5 1.4h6.4a1.5 1.5 0 001.5-1.4l.8-12" />
    </Icon>
  );
}

export function SendIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 12L19.5 4.5 14 19.5l-2.5-6L4.5 12z" />
    </Icon>
  );
}

export function MicIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="3.5" width="6" height="10.5" rx="3" />
      <path d="M6 11.5a6 6 0 0012 0" />
      <path d="M12 17.5V21" />
    </Icon>
  );
}

export function MapPinIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-6.4 7-11.5a7 7 0 10-14 0C5 14.6 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.25" />
    </Icon>
  );
}

export function PhoneIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5.5 4.5h3l1.5 4-2 1.5a11 11 0 006 6l1.5-2 4 1.5v3a1.5 1.5 0 01-1.6 1.5A16 16 0 014 6.1 1.5 1.5 0 015.5 4.5z" />
    </Icon>
  );
}

export function BriefcaseIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="7.5" width="17" height="11.5" rx="1.5" />
      <path d="M8.5 7.5V6a2 2 0 012-2h3a2 2 0 012 2v1.5" />
      <path d="M3.5 12.5h17" />
    </Icon>
  );
}

export function FileTextIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 3.5h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1v-16a1 1 0 011-1z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 13h6M9 16.5h6" />
    </Icon>
  );
}

export function CameraIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 8.5A1.5 1.5 0 015.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z" />
      <circle cx="12" cy="12.5" r="3.25" />
    </Icon>
  );
}

export function CompassIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2l-2 5.6-5.6 2 2-5.6 5.6-2z" />
    </Icon>
  );
}

export function SparkleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7-1.7 4.8-1.7-4.8-4.8-1.7 4.8-1.7L12 3.5z" />
    </Icon>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18.5 12h-13" />
      <path d="M10 6.5L4.5 12l5.5 5.5" />
    </Icon>
  );
}

export function BatteryIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="8" width="16" height="8" rx="1.5" />
      <path d="M21.5 10.5v3" />
    </Icon>
  );
}

export function ActivityIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </Icon>
  );
}

export function SettingsIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </Icon>
  );
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v5.5l3.5 2" />
    </Icon>
  );
}

export function TimerIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M10 2h4" />
      <path d="M12 2v2" />
      <path d="M19.4 5.6l-1.2 1.2" />
    </Icon>
  );
}

export function Volume2Icon(props) {
  return (
    <Icon {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </Icon>
  );
}

export function VolumeXIcon(props) {
  return (
    <Icon {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </Icon>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function RadioIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </Icon>
  );
}

export function ShieldCheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  );
}

export function PlayIcon(props) {
  return (
    <Icon {...props}>
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon(props) {
  return (
    <Icon {...props}>
      <rect x="6" y="4" width="4" height="16" fill="currentColor" />
      <rect x="14" y="4" width="4" height="16" fill="currentColor" />
    </Icon>
  );
}

export function DownloadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Icon>
  );
}

export function CopyIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}

export function VideoIcon(props) {
  return (
    <Icon {...props}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </Icon>
  );
}

export function PhoneOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </Icon>
  );
}

export function KeypadIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
      <circle cx="6" cy="18" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" />
    </Icon>
  );
}

export function SirenIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
      <path d="M5 21h14" />
      <path d="M12 2v3" />
      <path d="M4.93 4.93l2.12 2.12" />
      <path d="M19.07 4.93l-2.12 2.12" />
    </Icon>
  );
}

export function FolderIcon(props) {
  return (
    <Icon {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

export function ShareIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </Icon>
  );
}

export function NavigationIcon(props) {
  return (
    <Icon {...props}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </Icon>
  );
}

export function ExternalLinkIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </Icon>
  );
}

export function WhatsAppIcon({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function CameraOffIcon(props) {
  return (
    <Icon {...props}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
      <path d="M14.12 14.12a4 4 0 1 1-5.66-5.66" />
    </Icon>
  );
}

export function HandIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M6 14v-1.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6.5a8 8 0 0 0 8 8h1a8 8 0 0 0 8-8v-3a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2" />
    </Icon>
  );
}

export function EyeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Icon>
  );
}

export function HomeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </Icon>
  );
}

export function CarIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 17a2 2 0 104 0 2 2 0 10-4 0M15 17a2 2 0 104 0 2 2 0 10-4 0" />
      <path d="M5 17H3v-4l2-5h10l2 5v4h-2M5 12h14" />
    </Icon>
  );
}

export function HeartbeatIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2-4 4 8 2-4h6" />
    </Icon>
  );
}

export function MessageSquareIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}



