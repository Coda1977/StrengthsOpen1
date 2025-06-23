import { memo } from 'react';

// Memoized team member card to prevent unnecessary re-renders
export const TeamMemberCard = memo(({ 
  member, 
  onEdit, 
  onDelete, 
  isDeleting 
}: {
  member: { id: string; name: string; strengths: string[] };
  onEdit: (member: any) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex justify-between items-start mb-3">
      <h3 className="font-semibold text-text-primary">{member.name}</h3>
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(member)}
          className="text-blue-600 hover:text-blue-800 text-sm"
          disabled={isDeleting}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(member.id)}
          className="text-red-600 hover:text-red-800 text-sm"
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
    <div className="flex flex-wrap gap-1">
      {member.strengths.map((strength) => (
        <span
          key={strength}
          className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
        >
          {strength}
        </span>
      ))}
    </div>
  </div>
));

// Memoized strength selector
export const StrengthSelector = memo(({ 
  strengths, 
  selectedStrengths, 
  onToggle 
}: {
  strengths: readonly string[];
  selectedStrengths: string[];
  onToggle: (strength: string) => void;
}) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
    {strengths.map(strength => (
      <label key={strength} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={selectedStrengths.includes(strength)}
          onChange={() => onToggle(strength)}
          className="rounded"
        />
        <span className="text-sm">{strength}</span>
      </label>
    ))}
  </div>
));

// Memoized domain chart
export const DomainChart = memo(({ 
  data 
}: {
  data: Array<{ domain: string; count: number; percentage: number }>;
}) => (
  <div className="space-y-3">
    {data.map(({ domain, count, percentage }) => (
      <div key={domain} className="flex items-center justify-between">
        <span className="text-sm font-medium">{domain}</span>
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 min-w-[3rem]">{count} ({percentage}%)</span>
        </div>
      </div>
    ))}
  </div>
));

// Memoized top strengths list
export const TopStrengthsList = memo(({ 
  strengths 
}: {
  strengths: Array<{ strength: string; count: number }>;
}) => (
  <div className="space-y-2">
    {strengths.map(({ strength, count }, index) => (
      <div key={strength} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600">#{index + 1}</span>
          <span className="font-medium">{strength}</span>
        </div>
        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {count} {count === 1 ? 'person' : 'people'}
        </span>
      </div>
    ))}
  </div>
));

TeamMemberCard.displayName = 'TeamMemberCard';
StrengthSelector.displayName = 'StrengthSelector';
DomainChart.displayName = 'DomainChart';
TopStrengthsList.displayName = 'TopStrengthsList';