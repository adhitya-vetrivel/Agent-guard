import { cn } from '@/lib/utils'

const grades = ['A', 'B', 'C', 'D', 'F'] as const
type Grade = (typeof grades)[number]

interface SecurityGradeProps {
  grade: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const gradeColors: Record<Grade, string> = {
  A: 'text-success border-success',
  B: 'text-warning border-warning',
  C: 'text-warning border-warning',
  D: 'text-danger border-danger',
  F: 'text-danger border-danger',
}

const gradeDesc: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Fair',
  D: 'Poor',
  F: 'Critical',
}

export function SecurityGrade({ grade, size = 'md', showLabel = true }: SecurityGradeProps) {
  const normalized = (grade || 'F').toUpperCase() as Grade
  const sizeClasses = size === 'sm' ? 'h-8 w-8 text-sm' : size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-lg'

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-lg border-2 font-bold',
          gradeColors[normalized] || 'text-muted-foreground border-border',
          sizeClasses
        )}
      >
        {grades.includes(normalized) ? normalized : '?'}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {gradeDesc[normalized] || 'Unknown'}
        </span>
      )}
    </div>
  )
}
