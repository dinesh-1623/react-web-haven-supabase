/*
  # Create helpful views for assignment management

  1. Views
    - `assignment_stats` - Aggregated statistics for each assignment
    - `student_assignment_progress` - Student progress across assignments

  2. Security
    - Views inherit RLS from underlying tables
    - No additional policies needed as base table policies apply
*/

-- View: Assignment statistics with submission counts and averages
CREATE OR REPLACE VIEW assignment_stats AS
SELECT 
  a.id,
  a.title,
  a.course_id,
  a.type,
  a.status,
  a.due_date,
  a.max_score,
  c.title as course_title,
  c.instructor_id,
  COUNT(s.id) as total_submissions,
  COUNT(CASE WHEN s.status IN ('graded', 'returned') THEN 1 END) as graded_submissions,
  COUNT(CASE WHEN s.status IN ('submitted', 'late') THEN 1 END) as pending_submissions,
  ROUND(AVG(CASE WHEN s.score IS NOT NULL THEN s.score END), 1) as average_score,
  COUNT(CASE WHEN s.submitted_at > a.due_date THEN 1 END) as late_submissions
FROM assignments a
LEFT JOIN courses c ON c.id = a.course_id
LEFT JOIN submissions s ON s.assignment_id = a.id
GROUP BY a.id, a.title, a.course_id, a.type, a.status, a.due_date, a.max_score, c.title, c.instructor_id;

-- View: Student assignment progress
CREATE OR REPLACE VIEW student_assignment_progress AS
SELECT 
  p.id as student_id,
  p.full_name as student_name,
  a.id as assignment_id,
  a.title as assignment_title,
  a.course_id,
  a.due_date,
  a.max_score,
  s.status as submission_status,
  s.score,
  s.submitted_at,
  s.graded_at,
  CASE 
    WHEN s.submitted_at IS NULL THEN 'not_submitted'
    WHEN s.submitted_at > a.due_date THEN 'late'
    WHEN s.score IS NOT NULL THEN 'graded'
    ELSE 'submitted'
  END as progress_status
FROM profiles p
CROSS JOIN assignments a
LEFT JOIN enrollments e ON e.user_id = p.id AND e.course_id = a.course_id
LEFT JOIN submissions s ON s.user_id = p.id AND s.assignment_id = a.id
WHERE p.role = 'student' 
  AND e.status = 'active'
  AND a.status = 'published';