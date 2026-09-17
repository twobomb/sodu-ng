import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useCall, useMunicipalities, useUpdateCall, useSetCallStatus, useSetCallUnits, useAddCallEvent, useDeleteCallEvent } from '../../hooks/useCalls';
import { useUnits } from '../../hooks/useUnits';
import { usePermissions } from '../../hooks/usePermissions';
import { useFireCategories, useFireCauses, useFireNonaccountReasons } from '../../hooks/useDictionaries';
import { CALL_TYPES, CALL_RANKS, CALL_STATUS_META, CALL_STATUS_TRANSITIONS, AREA_TYPES, nowLocalInput, toLocalInput, toIso, formatDateTime } from '../../lib/calls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/ui/searchable-select';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import VictimsGroup from '../../components/calls/VictimsGroup';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Save, Plus, Trash2, Loader2, Siren, User } from 'lucide-react';

// Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ-Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’В·Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В° (Р В Р’В Р В РІР‚В  Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р Р†Р вЂљРЎСљ Р В Р вЂ Р В РІР‚С™Р Р†Р вЂљРЎСљ timestamptz)
const DATETIME_FIELDS = [
    'incident_at',
    'message_received_at',
    'dispatch_at',
    'arrival_at',
    'localization_at',
    'open_fire_eliminated_at',
    'fire_eliminated_at',
];

// Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ-Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В° Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В¦
const VICTIM_NUMBER_FIELDS = [
    'victims_dead_total', 'victims_dead_children',
    'victims_injured_total', 'victims_injured_children',
    'victims_rescued_total', 'victims_rescued_children',
    'victims_evacuated_total', 'victims_evacuated_children',
];
// Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏ-Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ Р В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В¦ (jsonb)
const VICTIM_DATA_FIELDS = [
    'victims_dead_data',
    'victims_injured_data',
    'victims_rescued_data',
];

const EMPTY_FORM = {
    type: 'Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™',
    rank: '',
    incident_at: '',
    message_received_at: '',
    municipality_id: '',
    address: '',
    dispatch_at: '',
    arrival_at: '',
    localization_at: '',
    open_fire_eliminated_at: '',
    fire_eliminated_at: '',
    description: '',
    fire_area: '',
    area_type: 'urban',
    fire_category_id: '',
    fire_cause_id: '',
    fire_cause_other: '',
    not_accounted_fire: false,
    not_accounted_reason_id: '',
    victims_dead_total: '', victims_dead_children: '', victims_dead_data: [],
    victims_injured_total: '', victims_injured_children: '', victims_injured_data: [],
    victims_rescued_total: '', victims_rescued_children: '', victims_rescued_data: [],
    victims_evacuated_total: '', victims_evacuated_children: '',
};

// Р В Р’В Р РЋРЎСџР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р Р‹Р Р†Р вЂљР’В¦ Р В Р Р‹Р В РЎвЂњ Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В° (ISO) Р В Р’В Р В РІР‚В  Р В Р’В Р вЂ™Р’В·Р В Р’В Р В РІР‚В¦Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ Р В Р Р‹Р Р†Р вЂљРЎвЂєР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋР’ВР В Р Р‹Р Р†Р вЂљРІвЂћвЂ“ (datetime-local / Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В)
const fromServer = (call) => {
    const f = { ...EMPTY_FORM };
    for (const k of DATETIME_FIELDS) f[k] = toLocalInput(call?.[k]);
    f.type = call?.type || 'Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™';
    f.rank = call?.rank || '';
    f.municipality_id = call?.municipality_id || '';
    f.address = call?.address || '';
    f.description = call?.description || '';
    f.fire_area = call?.fire_area ?? '';
    f.area_type = call?.area_type || 'urban';
    f.fire_category_id = call?.fire_category_id || '';
    f.fire_cause_id = call?.fire_cause_id || '';
    f.fire_cause_other = call?.fire_cause_other || '';
    f.not_accounted_fire = !!call?.not_accounted_fire;
    f.not_accounted_reason_id = call?.not_accounted_reason_id || '';
    for (const k of VICTIM_NUMBER_FIELDS) f[k] = call?.[k] ?? '';
    for (const k of VICTIM_DATA_FIELDS) f[k] = Array.isArray(call?.[k]) ? call[k] : [];
    return f;
};

const DateTimeField = ({ id, label, value, onChange, disabled, onFocusSetNow }) => (
    <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
            id={id}
            type="datetime-local"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { if (!value && !disabled) onFocusSetNow(); }}
            className="rounded-lg"
        />
    </div>
);

const HOSP_OPTIONS = [
    { value: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ', label: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ' },
    { value: 'Р В Р’В Р РЋРІР‚в„ўР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В±Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ', label: 'Р В Р’В Р РЋРІР‚в„ўР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В±Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ' },
];

// ---------- Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚С”Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’В¤Р В Р’В Р вЂ™Р’ВР В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р В РІвЂљВ¬Р В Р’В Р вЂ™Р’В Р В Р’В Р РЋРІР‚в„ўР В Р’В Р вЂ™Р’В¦Р В Р’В Р вЂ™Р’ВР В Р’В Р В РІР‚РЋ Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В Р’В Р РЋРІР‚в„ўР В Р’В Р вЂ™Р’В¤ Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚С”Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В Р’В Р РЋРІР‚в„ўР В Р’В Р Р†Р вЂљРЎСљР В Р’В Р РЋРІР‚в„ўР В Р’В Р Р†Р вЂљРІвЂћСћР В Р’В Р В Р С“Р В Р’В Р вЂ™Р’ВР В Р’В Р СћРЎвЂ™ ----------
const VICTIM_GROUPS = [
    {
        title: 'Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚Сћ Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ',
        totalKey: 'victims_dead_total',
        childrenKey: 'victims_dead_children',
        dataKey: 'victims_dead_data',
        fields: [
            { key: 'fio', label: 'Р В Р’В Р вЂ™Р’В¤Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚С”' },
            { key: 'birth_year', label: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ' },
        ],
    },
    {
        title: 'Р В Р’В Р РЋРЎвЂєР В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В Р В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ',
        totalKey: 'victims_injured_total',
        childrenKey: 'victims_injured_children',
        dataKey: 'victims_injured_data',
        fields: [
            { key: 'fio', label: 'Р В Р’В Р вЂ™Р’В¤Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚С”' },
            { key: 'birth_year', label: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ' },
            { key: 'diagnosis', label: 'Р В Р’В Р Р†Р вЂљРЎСљР В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р РЋРІР‚вЂњР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В·' },
            { key: 'hospitalization', label: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚вЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’В·Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ', type: 'select', options: HOSP_OPTIONS },
            { key: 'hospital', label: 'Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В° / Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’В±Р В Р Р‹Р РЋРІР‚СљР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚СћР В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ', placeholder: 'Р В Р’В Р Р†Р вЂљР’ВР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В°' },
        ],
    },
    {
        title: 'Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚вЂќР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚Сћ Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В РІР‚в„–Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р Р†РІР‚С›РІР‚вЂњ',
        totalKey: 'victims_rescued_total',
        childrenKey: 'victims_rescued_children',
        dataKey: 'victims_rescued_data',
        fields: [
            { key: 'fio', label: 'Р В Р’В Р вЂ™Р’В¤Р В Р’В Р вЂ™Р’ВР В Р’В Р РЋРІР‚С”' },
            { key: 'birth_year', label: 'Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚В Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В¶Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ' },
        ],
    },
];

// ============================================================
const CallDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { has } = usePermissions();

    const callQuery = useCall(id);
    const munisQuery = useMunicipalities();
    const unitsQuery = useUnits();
    const catsQuery = useFireCategories();
    const causesQuery = useFireCauses();
    const nonAccQuery = useFireNonaccountReasons();

    const updateCall = useUpdateCall();
    const setStatus = useSetCallStatus();
    const setUnits = useSetCallUnits();
    const addEvent = useAddCallEvent();
    const deleteEvent = useDeleteCallEvent();

    const call = callQuery.data;
    const callStatus = call?.status;

    const canChangeStatus = has('calls.update_status') &&
        (callStatus !== 'closed' || has('calls.update_closed'));
    const canEdit = callStatus === 'closed'
        ? has('calls.update_closed')
        : has('calls.update');

    // ---------- Р В Р’В¤Р В РЎвЂўР РЋР вЂљР В РЎВР В Р’В° (Р В Р’В»Р В РЎвЂўР В РЎвЂќР В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р В РЎвЂўР В Р’Вµ Р РЋР вЂљР В Р’ВµР В РўвЂР В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ) ----------
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (call && !dirty) {
            setFormData(fromServer(call));
        }
    }, [call, dirty]);

    const setField = (field, value) => {
        setDirty(true);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };
    const setFieldNow = (field) => setField(field, nowLocalInput());

    const handleNumber = (field) => (e) => {
        setField(field, e.target.value === '' ? '' : Number(e.target.value));
    };
    const handleVictimData = (key) => (arr) => setField(key, arr);

    // ---------- Р В Р Р‹Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В РЎвЂўР РЋРІР‚РЋР В Р вЂ¦Р В РЎвЂР В РЎвЂќР В РЎвЂ ----------
    const fireCats = Array.isArray(catsQuery.data) ? catsQuery.data : [];
    const fireCauses = Array.isArray(causesQuery.data) ? causesQuery.data : [];
    const nonAccReasons = Array.isArray(nonAccQuery.data) ? nonAccQuery.data : [];

    const catsById = useMemo(() => {
        const m = {};
        for (const c of fireCats) m[c.id] = c;
        return m;
    }, [fireCats]);

    const catsByParent = useMemo(() => {
        const m = {};
        for (const c of fireCats) {
            const pid = c.parent_id || '__ROOT__';
            if (!m[pid]) m[pid] = [];
            m[pid].push(c);
        }
        for (const k in m) m[k].sort((a, b) => String(a.code).localeCompare(String(b.code), 'ru'));
        return m;
    }, [fireCats]);

    // Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ Р РЋРІР‚в„–Р В Р’В±Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р В РЎвЂўР В РІвЂћвЂ“ Р В РЎвЂќР В Р’В°Р РЋРІР‚С™Р В Р’ВµР В РЎвЂ“Р В РЎвЂўР РЋР вЂљР В РЎвЂР В РЎвЂ: [lvl1, lvl2, lvl3]
    const catPath = useMemo(() => {
        const id = formData.fire_category_id;
        if (!id || !catsById[id]) return [];
        const arr = [];
        let node = catsById[id];
        while (node) {
            arr.unshift(node);
            node = node.parent_id ? catsById[node.parent_id] : null;
        }
        return arr;
    }, [formData.fire_category_id, catsById]);

    const handleCategoryChange = (catId, depth) => {
        // Р В РЎСџР РЋР вЂљР В РЎвЂ Р РЋР С“Р В РЎВР В Р’ВµР В Р вЂ¦Р В Р’Вµ Р РЋРЎвЂњР РЋР вЂљР В РЎвЂўР В Р вЂ Р В Р вЂ¦Р РЋР РЏ Р РЋР С“Р В Р’В±Р РЋР вЂљР В Р’В°Р РЋР С“Р РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎВ Р В Р’В±Р В РЎвЂўР В Р’В»Р В Р’ВµР В Р’Вµ Р В РЎвЂ“Р В Р’В»Р РЋРЎвЂњР В Р’В±Р В РЎвЂўР В РЎвЂќР В РЎвЂР В Р’Вµ (Р В РЎвЂўР В Р вЂ¦Р В РЎвЂ Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В РЎвЂўР РЋР РЏР РЋРІР‚С™Р РЋР С“Р РЋР РЏ Р В Р вЂ¦Р В РЎвЂР В Р’В¶Р В Р’Вµ)
        setField('fire_category_id', catId);
    };

    const causeOptions = fireCauses.map((c) => ({ value: c.id, label: c.name }));
    const selectedCause = fireCauses.find((c) => c.id === formData.fire_cause_id);
    const isOtherCause = selectedCause && selectedCause.name.includes('Р В Р’ВР В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂР РЋРІР‚РЋР В РЎвЂР В Р вЂ¦Р РЋРІР‚в„–');

    // ---------- Р В Р Р‹Р В РЎвЂўР РЋРІР‚В¦Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ ----------
    const handleSave = () => {
        if (!call || updateCall.isPending) return;
        const payload = {
            type: formData.type || 'Р В РЎСџР В РЎвЂўР В Р’В¶Р В Р’В°Р РЋР вЂљ',
            rank: formData.rank || '',
            municipality_id: formData.municipality_id ? formData.municipality_id : null,
            address: formData.address || '',
            description: formData.description || '',
            fire_area: formData.fire_area === '' || formData.fire_area === null ? null : Number(formData.fire_area),
            area_type: formData.area_type || 'urban',
            fire_category_id: formData.fire_category_id || null,
            fire_cause_id: formData.fire_cause_id || null,
            fire_cause_other: formData.fire_cause_other || '',
            not_accounted_fire: !!formData.not_accounted_fire,
            not_accounted_reason_id: formData.not_accounted_reason_id || null,
        };
        for (const k of DATETIME_FIELDS) payload[k] = toIso(formData[k]);
        for (const k of VICTIM_NUMBER_FIELDS) {
            payload[k] = formData[k] === '' || formData[k] === null ? null : Number(formData[k]);
        }
        for (const k of VICTIM_DATA_FIELDS) payload[k] = formData[k] || [];

        updateCall.mutate(
            { id, data: payload },
            {
                onSuccess: (res) => {
                    const updated = res?.data || res;
                    if (updated) setFormData(fromServer(updated));
                    setDirty(false);
                },
            }
        );
    };

    // ---------- Р В Р Р‹Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњР РЋР С“ (Р РЋР С“ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В Р’В¶Р В РўвЂР В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’ВµР В РЎВ) ----------
    const [statusConfirm, setStatusConfirm] = useState(null);
    const handleConfirmStatus = () => {
        if (!statusConfirm) return;
        setStatus.mutate({ id, status: statusConfirm.value });
        setStatusConfirm(null);
    };

    // ---------- Р В РЎС›Р В Р’ВµР РЋРІР‚В¦Р В Р вЂ¦Р В РЎвЂР В РЎвЂќР В Р’В° ----------
    const [unitToRemove, setUnitToRemove] = useState(null);
    const attachedUnits = call?.units || [];
    const attachedIds = new Set(attachedUnits.map((u) => u.unit_id));
    const availableUnits = Array.isArray(unitsQuery.data) ? unitsQuery.data : (unitsQuery.data?.data || []);
    const unitOptions = availableUnits
        .filter((u) => !attachedIds.has(u.id))
        .map((u) => ({ value: u.id, label: u.name, extra: [u.type_short_name, u.plate_number, u.department_name].filter(Boolean).join(' Р вЂ™Р’В· ') }));

    const handleAddUnit = (unitId) => {
        if (!unitId || !call || setUnits.isPending) return;
        if (attachedIds.has(unitId)) return;
        setUnits.mutate({ id, unitIds: [...attachedIds, unitId] });
    };
    const confirmRemoveUnit = () => {
        if (!unitToRemove) return;
        const next = [...attachedIds].filter((x) => x !== unitToRemove);
        setUnits.mutate({ id, unitIds: next });
        setUnitToRemove(null);
    };

    // ---------- Р В РўС’Р В РЎвЂўР В РўвЂ Р РЋР С“Р В РЎвЂўР В Р’В±Р РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР В РІвЂћвЂ“ ----------
    const [eventOpen, setEventOpen] = useState(false);
    const [eventAt, setEventAt] = useState(nowLocalInput());
    const [eventText, setEventText] = useState('');
    const [eventToDelete, setEventToDelete] = useState(null);

    const openEventDialog = () => {
        setEventAt(nowLocalInput());
        setEventText('');
        setEventOpen(true);
    };
    const handleAddEvent = () => {
        if (!eventText.trim() || addEvent.isPending) return;
        addEvent.mutate(
            { id, data: { event_at: toIso(eventAt), text: eventText.trim() } },
            { onSuccess: () => setEventOpen(false) }
        );
    };

    // ---------- Р В Р в‚¬Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂ Р РЋР С“Р В РЎвЂў Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В РЎвЂР РЋРІР‚В Р РЋРІР‚в„– Р РЋР С“ Р В Р вЂ¦Р В Р’ВµР РЋР С“Р В РЎвЂўР РЋРІР‚В¦Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р РЋРІР‚ВР В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В РЎВР В РЎвЂ Р В РўвЂР В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В РЎВР В РЎвЂ ----------
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            dirty && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (!dirty) return;
        const handler = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    // ---------- Р В РІР‚вЂќР В Р’В°Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂќР В Р’В° ----------
    if (callQuery.isLoading && !call) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }
    if (callQuery.error && !call) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Р В РЎвЂєР РЋРІвЂљВ¬Р В РЎвЂР В Р’В±Р В РЎвЂќР В Р’В° Р В Р’В·Р В Р’В°Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂќР В РЎвЂ Р В Р вЂ Р РЋРІР‚в„–Р В Р’В·Р В РЎвЂўР В Р вЂ Р В Р’В°
            </div>
        );
    }
    if (!call) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Р В РІР‚в„ўР РЋРІР‚в„–Р В Р’В·Р В РЎвЂўР В Р вЂ  Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ¦Р В Р’В°Р В РІвЂћвЂ“Р В РўвЂР В Р’ВµР В Р вЂ¦
            </div>
        );
    }

    const statusMeta = CALL_STATUS_META[call.status] || { label: call.status, badge: 'bg-slate-500' };
    const transitions = CALL_STATUS_TRANSITIONS[call.status] || [];

    const munisList = Array.isArray(munisQuery.data) ? munisQuery.data : (munisQuery.data?.data || []);
    const municipalityOptions = munisList.map((m) => ({ value: m.id, label: m.name, extra: m.department_name || '' }));
    if (call.municipality_id && !municipalityOptions.some((o) => o.value === call.municipality_id)) {
        municipalityOptions.unshift({ value: call.municipality_id, label: call.municipality_name || 'Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂўР В РЎвЂќР РЋР вЂљР РЋРЎвЂњР В РЎвЂ“', extra: 'Р В РЎС›Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂўР В РЎвЂќР РЋР вЂљР РЋРЎвЂњР В РЎвЂ“' });
    }

    const isFire = formData.type === 'Р В РЎСџР В РЎвЂўР В Р’В¶Р В Р’В°Р РЋР вЂљ';

    return (
        <div className="space-y-4">
            {/* Р РЃР В°Р С—Р С”Р В° */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <Button variant="ghost" onClick={() => navigate('/calls')} className="rounded-lg h-9 w-9 p-0" title="Р С™ РЎРѓР С—Р С‘РЎРѓР С”РЎС“ Р Р†РЎвЂ№Р В·Р С•Р Р†Р С•Р Р†">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Siren className="h-6 w-6 text-red-500" /> Р вЂ™РЎвЂ№Р В·Р С•Р Р†
                    </h1>
                    <Badge className={`${statusMeta.badge} text-white`}>{statusMeta.label}</Badge>
                    {dirty && <Badge className="bg-amber-500 text-white">Р ВµРЎРѓРЎвЂљРЎРЉ Р Р…Р ВµРЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…РЎвЂР Р…Р Р…РЎвЂ№Р Вµ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ</Badge>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canChangeStatus && transitions.map((t) => (
                        <Button key={t.value} variant="outline" onClick={() => setStatusConfirm(t)} className="rounded-lg">{t.label}</Button>
                    ))}
                    {canEdit && (
                        <Button onClick={handleSave} disabled={updateCall.isPending || !dirty} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            {updateCall.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ
                        </Button>
                    )}
                </div>
            </div>

            {/* Р РЋР С•Р В·Р Т‘Р В°РЎвЂљР ВµР В»РЎРЉ */}
            {call.creator_username && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <User className="h-4 w-4 text-slate-400" />
                    Р РЋР С•Р В·Р Т‘Р В°Р В»: <span className="font-medium text-slate-700">{call.creator_username}</span>
                    {call.department_name && <span className="text-slate-400">Р’В· Р СџР С•Р Т‘РЎР‚Р В°Р В·Р Т‘Р ВµР В»Р ВµР Р…Р С‘Р Вµ: {call.department_name}</span>}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* ---------- Р вЂєР ВµР Р†Р В°РЎРЏ Р С”Р С•Р В»Р С•Р Р…Р С”Р В° ---------- */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Р С›Р В±РЎвЂ°Р В°РЎРЏ Р С‘Р Р…РЎвЂћР С•РЎР‚Р СР В°РЎвЂ Р С‘РЎРЏ */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">Р С›Р В±РЎвЂ°Р В°РЎРЏ Р С‘Р Р…РЎвЂћР С•РЎР‚Р СР В°РЎвЂ Р С‘РЎРЏ</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="type">Р СћР С‘Р С— Р Р†РЎвЂ№Р В·Р С•Р Р†Р В°</Label>
                                <NativeSelect value={formData.type} onChange={(e) => setField('type', e.target.value)} disabled={!canEdit} className="w-full">
                                    {CALL_TYPES.map((t) => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
                                </NativeSelect>
                            </div>
                            <DateTimeField id="incident_at" label="Р вЂќР В°РЎвЂљР В° Р С‘ Р Р†РЎР‚Р ВµР СРЎРЏ Р Р†Р С•Р В·Р Р…Р С‘Р С”Р Р…Р С•Р Р†Р ВµР Р…Р С‘РЎРЏ РЎРѓР С•Р В±РЎвЂ№РЎвЂљР С‘РЎРЏ" value={formData.incident_at} onChange={(v) => setField('incident_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('incident_at')} />
                            <DateTimeField id="message_received_at" label="Р вЂ™РЎР‚Р ВµР СРЎРЏ Р С—Р С•Р В»РЎС“РЎвЂЎР ВµР Р…Р С‘РЎРЏ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘РЎРЏ" value={formData.message_received_at} onChange={(v) => setField('message_received_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('message_received_at')} />
                            <div className="space-y-2">
                                <Label htmlFor="municipality">Р СљРЎС“Р Р…Р С‘РЎвЂ Р С‘Р С—Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– / Р С–Р С•РЎР‚Р С•Р Т‘РЎРѓР С”Р С•Р в„– Р С•Р С”РЎР‚РЎС“Р С–</Label>
                                <SearchableSelect options={municipalityOptions} value={formData.municipality_id || ''} onChange={(v) => setField('municipality_id', v)} placeholder="Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ Р С•Р С”РЎР‚РЎС“Р С–..." emptyText="Р СњР ВµРЎвЂљ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…РЎвЂ№РЎвЂ¦ Р С•Р С”РЎР‚РЎС“Р С–Р С•Р Р†" disabled={!canEdit} renderOption={(o) => (
                                    <div className="flex flex-col min-w-0"><span className="text-sm truncate">{o.label}</span>{o.extra && <span className="text-[11px] text-slate-400 truncate">{o.extra}</span>}</div>
                                )} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Р С’Р Т‘РЎР‚Р ВµРЎРѓ Р СР ВµРЎРѓРЎвЂљР В° Р С—РЎР‚Р С•Р С‘РЎРѓРЎв‚¬Р ВµРЎРѓРЎвЂљР Р†Р С‘РЎРЏ</Label>
                                <Input id="address" placeholder="Р С’Р Т‘РЎР‚Р ВµРЎРѓ" value={formData.address} onChange={(e) => setField('address', e.target.value)} disabled={!canEdit} className="rounded-lg" />
                            </div>
                            <DateTimeField id="dispatch_at" label="Р вЂ™РЎР‚Р ВµР СРЎРЏ Р Р†РЎвЂ№РЎРѓРЎвЂ№Р В»Р С”Р С‘ РЎРѓР С‘Р В» Р С‘ РЎРѓРЎР‚Р ВµР Т‘РЎРѓРЎвЂљР Р†" value={formData.dispatch_at} onChange={(v) => setField('dispatch_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('dispatch_at')} />
                            <DateTimeField id="arrival_at" label="Р вЂ™РЎР‚Р ВµР СРЎРЏ Р С—РЎР‚Р С‘Р В±РЎвЂ№РЎвЂљР С‘РЎРЏ" value={formData.arrival_at} onChange={(v) => setField('arrival_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('arrival_at')} />
                        </div>
                    </div>

                    {/* Р С›Р С—Р ВµРЎР‚Р В°РЎвЂљР С‘Р Р†Р Р…Р С•-РЎвЂљР В°Р С”РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р В°РЎРЏ Р С•Р В±РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С”Р В° Р С‘ Р С•Р В±РЎР‰Р ВµР С”РЎвЂљРЎвЂ№ Р С—Р С•Р В¶Р В°РЎР‚Р В° */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Р С›Р С—Р ВµРЎР‚Р В°РЎвЂљР С‘Р Р†Р Р…Р С•-РЎвЂљР В°Р С”РЎвЂљР С‘РЎвЂЎР ВµРЎРѓР С”Р В°РЎРЏ Р С•Р В±РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С”Р В° Р С‘ Р С•Р В±РЎР‰Р ВµР С”РЎвЂљРЎвЂ№ Р С—Р С•Р В¶Р В°РЎР‚Р В°</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="rank">Р В Р В°Р Р…Р С– Р Р†РЎвЂ№Р В·Р С•Р Р†Р В°</Label>
                                    <NativeSelect value={formData.rank} onChange={(e) => setField('rank', e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Р СњР Вµ РЎС“Р С”Р В°Р В·Р В°Р Р…</NativeSelectOption>
                                        {CALL_RANKS.map((r) => <NativeSelectOption key={r} value={r}>{r}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fire_area">Р СџР В»Р С•РЎвЂ°Р В°Р Т‘РЎРЉ Р С—Р С•Р В¶Р В°РЎР‚Р В°, Р СР’Р†</Label>
                                    <Input id="fire_area" type="number" min="0" value={formData.fire_area === '' || formData.fire_area === null ? '' : formData.fire_area} disabled={!canEdit} onChange={(e) => setField('fire_area', e.target.value)} className="rounded-lg" />
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
                                <DateTimeField id="localization_at" label="Р вЂєР С•Р С”Р В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘РЎРЏ Р С—Р С•Р В¶Р В°РЎР‚Р В°" value={formData.localization_at} onChange={(v) => setField('localization_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('localization_at')} />
                                <DateTimeField id="open_fire_eliminated_at" label="Р вЂєР С‘Р С”Р Р†Р С‘Р Т‘Р В°РЎвЂ Р С‘РЎРЏ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР С•Р С–Р С• Р С–Р С•РЎР‚Р ВµР Р…Р С‘РЎРЏ" value={formData.open_fire_eliminated_at} onChange={(v) => setField('open_fire_eliminated_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('open_fire_eliminated_at')} />
                                <DateTimeField id="fire_eliminated_at" label="Р вЂєР С‘Р С”Р Р†Р С‘Р Т‘Р В°РЎвЂ Р С‘РЎРЏ Р С—Р С•Р В¶Р В°РЎР‚Р В°" value={formData.fire_eliminated_at} onChange={(v) => setField('fire_eliminated_at', v)} disabled={!canEdit} onFocusSetNow={() => setFieldNow('fire_eliminated_at')} />
                            </div>
                        </div>
                    )}

                    {/* Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С—Р С•Р В¶Р В°РЎР‚Р В° */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С‘Р Вµ Р С—Р С•Р В¶Р В°РЎР‚Р В°</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Р СљР ВµРЎРѓРЎвЂљР Р…Р С•РЎРѓРЎвЂљРЎРЉ</Label>
                                    <NativeSelect value={formData.area_type || 'urban'} onChange={(e) => setField('area_type', e.target.value)} disabled={!canEdit} className="w-full">
                                        {AREA_TYPES.map((a) => <NativeSelectOption key={a.value} value={a.value}>{a.label}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                <div className="space-y-2">
                                    <Label>Р С™Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ Р С—Р С•Р В¶Р В°РЎР‚Р В°</Label>
                                    <NativeSelect value={cat1 ? cat1.id : ''} onChange={(e) => handleCategoryChange(e.target.value, 1)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Р СњР Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р С•</NativeSelectOption>
                                        {(catsByParent['__ROOT__'] || []).map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.code ? c.code + ' ' : ''}{c.name}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                {cat1 && cat2Options.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Р СџР С•Р Т‘Р С”Р В°РЎвЂљР ВµР С–Р С•РЎР‚Р С‘РЎРЏ</Label>
                                        <NativeSelect value={cat2 ? cat2.id : ''} onChange={(e) => handleCategoryChange(e.target.value, 2)} disabled={!canEdit} className="w-full">
                                            <NativeSelectOption value="">Р СњР Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р С•</NativeSelectOption>
                                            {cat2Options.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
                                        </NativeSelect>
                                    </div>
                                )}
                                {cat2 && cat3Options.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Р СџРЎС“Р Р…Р С”РЎвЂљ</Label>
                                        <NativeSelect value={cat3 ? cat3.id : ''} onChange={(e) => handleCategoryChange(e.target.value, 3)} disabled={!canEdit} className="w-full">
                                            <NativeSelectOption value="">Р СњР Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р С•</NativeSelectOption>
                                            {cat3Options.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
                                        </NativeSelect>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Р СџРЎР‚Р С‘РЎвЂЎР С‘Р Р…Р В° Р С—Р С•Р В¶Р В°РЎР‚Р В° */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">Р СџРЎР‚Р С‘РЎвЂЎР С‘Р Р…Р В° Р С—Р С•Р В¶Р В°РЎР‚Р В°</h2>
                            <div className="grid gap-3 sm:grid-cols-2 items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="fire_cause">Р СџРЎР‚Р С‘РЎвЂЎР С‘Р Р…Р В°</Label>
                                    <NativeSelect value={formData.fire_cause_id || ''} onChange={(e) => setField('fire_cause_id', e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Р СњР Вµ РЎС“Р С”Р В°Р В·Р В°Р Р…Р В°</NativeSelectOption>
                                        {causeOptions.map((c) => <NativeSelectOption key={c.value} value={c.value}>{c.label}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                                {isOtherCause && (
                                    <div className="space-y-2">
                                        <Label htmlFor="fire_cause_other">Р Р€Р С”Р В°Р В¶Р С‘РЎвЂљР Вµ Р С—РЎР‚Р С‘РЎвЂЎР С‘Р Р…РЎС“</Label>
                                        <Input id="fire_cause_other" value={formData.fire_cause_other || ''} disabled={!canEdit} onChange={(e) => setField('fire_cause_other', e.target.value)} placeholder="Р СџРЎР‚Р С‘РЎвЂЎР С‘Р Р…Р В°..." className="rounded-lg" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Р СџР С•Р В¶Р В°РЎР‚ Р Р…Р Вµ Р С—Р С•Р Т‘Р В»Р ВµР В¶Р С‘РЎвЂљ РЎС“РЎвЂЎРЎвЂРЎвЂљРЎС“ */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 p-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!formData.not_accounted_fire} disabled={!canEdit} onChange={(e) => setField('not_accounted_fire', e.target.checked)} className="h-4 w-4 accent-orange-600" />
                                <span className="text-sm font-medium text-slate-700">Р СџР С•Р В¶Р В°РЎР‚ Р Р…Р Вµ Р С—Р С•Р Т‘Р В»Р ВµР В¶Р С‘РЎвЂљ РЎС“РЎвЂЎРЎвЂРЎвЂљРЎС“</span>
                            </label>
                            {formData.not_accounted_fire && (
                                <div className="space-y-2 mt-3">
                                    <Label htmlFor="not_acc">Р СџРЎР‚Р С‘РЎвЂЎР С‘Р Р…Р В° Р Р…Р ВµРЎС“РЎвЂЎРЎвЂРЎвЂљР В°</Label>
                                    <NativeSelect value={formData.not_accounted_reason_id || ''} onChange={(e) => setField('not_accounted_reason_id', e.target.value)} disabled={!canEdit} className="w-full">
                                        <NativeSelectOption value="">Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ... </NativeSelectOption>
                                        {nonAccReasons.map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.name}</NativeSelectOption>)}
                                    </NativeSelect>
                                </div>
                            )}
                        </div>
                    )}
                    {/* РџРѕСЃС‚СЂР°РґР°РІС€РёРµ */}
                    {isFire && (
                        <div className="rounded-xl border border-slate-200 p-4">
                            <h2 className="text-base font-semibold text-slate-700 mb-3">РџРѕСЃС‚СЂР°РґР°РІС€РёРµ</h2>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {VICTIM_GROUPS.map((g) => (
                                    <VictimsGroup
                                        key={g.dataKey}
                                        {...g}
                                        totalLabel={g.title + ', С‡РµР».'}
                                        values={formData}
                                        data={formData[g.dataKey] || []}
                                        disabled={!canEdit}
                                        onChangeValue={setField}
                                        onChangeData={(k, arr) => setField(k, arr)}
                                    />
                                ))}
                                <div className="rounded-lg border border-slate-200 p-3">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Р­РІР°РєСѓРёСЂРѕРІР°РЅРѕ Р»СЋРґРµР№</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">Р­РІР°РєСѓРёСЂРѕРІР°РЅРѕ, С‡РµР».</Label>
                                            <Input type="number" min="0" value={formData.victims_evacuated_total ?? ''} disabled={!canEdit} onChange={handleNumber('victims_evacuated_total')} className="rounded-lg" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">РІ С‚.С‡. РґРµС‚РµР№</Label>
                                            <Input type="number" min="0" value={formData.victims_evacuated_children ?? ''} disabled={!canEdit} onChange={handleNumber('victims_evacuated_children')} className="rounded-lg" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* РћРїРёСЃР°РЅРёРµ */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="space-y-2">
                            <Label htmlFor="description">РћРїРёСЃР°РЅРёРµ</Label>
                            <Textarea id="description" rows={4} placeholder="РћРїРёСЃР°РЅРёРµ РІС‹Р·РѕРІР°..." value={formData.description} onChange={(e) => setField('description', e.target.value)} disabled={!canEdit} className="rounded-lg" />
                        </div>
                    </div>

                    {/* РџСЂРёРІР»РµРєР°РµРјР°СЏ С‚РµС…РЅРёРєР° */}
                    <div className="rounded-xl border border-slate-200 p-4">
                        <h2 className="text-base font-semibold text-slate-700 mb-3">РџСЂРёРІР»РµРєР°РµРјР°СЏ С‚РµС…РЅРёРєР°</h2>
                        {canEdit && (
                            <SearchableSelect options={unitOptions} value="" onChange={handleAddUnit} placeholder="Р”РѕР±Р°РІРёС‚СЊ С‚РµС…РЅРёРєСѓ..." emptyText="РќРµС‚ РґРѕСЃС‚СѓРїРЅРѕР№ С‚РµС…РЅРёРєРё" renderOption={(o) => (
                                <div className="flex flex-col min-w-0"><span className="text-sm truncate">{o.label}</span>{o.extra && <span className="text-[11px] text-slate-400 truncate">{o.extra}</span>}</div>
                            )} />
                        )}
                        {!canEdit && !attachedUnits.length && <p className="text-sm text-slate-400">РўРµС…РЅРёРєР° РЅРµ РїСЂРёРІР»РµРєР°Р»Р°СЃСЊ</p>}
                        {attachedUnits.map((u) => (
                            <div key={u.unit_id} className="flex items-center justify-between gap-2 mt-2 rounded-lg border border-slate-200 px-3 py-2">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate">{u.unit_name}</span>
                                    <span className="text-[11px] text-slate-400 truncate">{[u.type_short_name, u.plate_number, u.department_name].filter(Boolean).join(' В· ') || 'вЂ”'}</span>
                                </div>
                                {canEdit && (
                                    <Button variant="ghost" size="sm" onClick={() => setUnitToRemove(u.unit_id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700" title="РЈР±СЂР°С‚СЊ С‚РµС…РЅРёРєСѓ">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                {/* ---------- Правая колонка: ход событий ---------- */}
                <div className="rounded-xl border border-slate-200 p-4 self-start">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-700">Ход событий</h2>
                        {canEdit && (
                            <Button variant="outline" size="sm" onClick={openEventDialog} className="rounded-lg h-8">
                                <Plus className="h-4 w-4 mr-1" /> Добавить
                            </Button>
                        )}
                    </div>
                    {call.events.length === 0 && <p className="text-sm text-slate-400">Событий пока нет</p>}
                    <div className="space-y-3 max-h-[60vh] overflow-auto">
                        {call.events.map((ev) => (
                            <div key={ev.id} className="rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{formatDateTime(ev.event_at)}</span>
                                    {canEdit && (
                                        <Button variant="ghost" size="sm" onClick={() => setEventToDelete(ev.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700" title="Удалить событие">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap mt-1">{ev.text}</p>
                                <span className="text-[11px] text-slate-400">{ev.author_username || '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Диалог добавления события */}
            <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader><DialogTitle className="text-xl">Добавить ход событий</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="event_at">Дата и время</Label>
                            <Input id="event_at" type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event_text">Описание хода</Label>
                            <Textarea id="event_text" rows={4} placeholder="Например: локализация пожара, в помощь отправлена АЦ..." value={eventText} onChange={(e) => setEventText(e.target.value)} className="rounded-lg" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEventOpen(false)} className="rounded-lg">Отмена</Button>
                        <Button type="button" onClick={handleAddEvent} disabled={addEvent.isPending || !eventText.trim()} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">{addEvent.isPending ? 'Сохранение...' : 'Добавить'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Диалог подтверждения смены статуса */}
            <AlertDialog open={!!statusConfirm} onOpenChange={(o) => { if (!o) setStatusConfirm(null); }}>
                {statusConfirm && (
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Смена статуса вызова</AlertDialogTitle>
                            <AlertDialogDescription>{statusConfirm.description}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmStatus} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">{statusConfirm.label}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>

            {/* Подтверждение удаления техники */}
            <AlertDialog open={!!unitToRemove} onOpenChange={(o) => { if (!o) setUnitToRemove(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Убрать технику</AlertDialogTitle>
                        <AlertDialogDescription>Убрать эту технику из привлекаемых к вызову?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveUnit} className="bg-red-600 hover:bg-red-700 rounded-lg">Убрать</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Подтверждение удаления события */}
            <AlertDialog open={!!eventToDelete} onOpenChange={(o) => { if (!o) setEventToDelete(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить событие</AlertDialogTitle>
                        <AlertDialogDescription>Удалить запись из хода событий? Это действие нельзя отменить.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if (eventToDelete) deleteEvent.mutate({ id, eventId: eventToDelete }); setEventToDelete(null); }} className="bg-red-600 hover:bg-red-700 rounded-lg">Удалить</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Предупреждение о несохранённых данных при уходе */}
            <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(o) => { if (!o) blocker.reset?.(); }}>
                <AlertDialogContent className="rounded-2xl data-[size=default]:sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Есть несохранённые изменения</AlertDialogTitle>
                        <AlertDialogDescription>Вы изменили параметры вызова, но не сохранили их. Сохранить изменения перед переходом?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => blocker.reset?.()} className="rounded-lg">Отмена</Button>
                        <Button variant="outline" onClick={() => blocker.proceed?.()} className="rounded-lg">Не сохранять</Button>
                        <AlertDialogAction onClick={() => { handleSave(); blocker.proceed?.(); }} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">Сохранить и перейти</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CallDetail;