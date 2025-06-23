import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  FileText, 
  User, 
  Calendar, 
  Clock,
  Download,
  Eye,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Assignment {
  id: string;
  title: string;
  course_title: string;
  due_date: string;
  type: 'quiz' | 'assignment' | 'exam';
  description?: string;
  max_score: number;
}

interface StudentSubmission {
  student_id: string;
  student_name: string;
  submission_status: 'not_submitted' | 'submitted' | 'late' | 'graded';
  score?: number;
  submitted_at?: string;
  graded_at?: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  submitted_at?: string;
  file_url?: string;
  answer_text?: string;
  score?: number;
  feedback?: string;
  status: 'pending' | 'submitted' | 'late' | 'graded' | 'returned';
  graded_by?: string;
  graded_at?: string;
}

interface GradingInterfaceProps {
  assignment: Assignment | undefined;
  studentId: string;
  onBack: () => void;
  onGradeSubmitted: () => void;
}

interface GradingFormData {
  score: number;
  feedback: string;
  status: 'graded' | 'returned';
}

const GradingInterface: React.FC<GradingInterfaceProps> = ({
  assignment,
  studentId,
  onBack,
  onGradeSubmitted
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [student, setStudent] = useState<StudentSubmission | null>(null);
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<GradingFormData>({
    defaultValues: {
      score: 0,
      feedback: '',
      status: 'graded'
    }
  });

  const watchedScore = watch('score');
  const watchedFeedback = watch('feedback');

  useEffect(() => {
    console.log('🔍 GradingInterface: Component mounted');
    console.log('🔍 GradingInterface: Assignment:', assignment);
    console.log('🔍 GradingInterface: Student ID:', studentId);
    
    if (assignment && studentId) {
      loadSubmissionData();
    }
  }, [assignment, studentId]);

  const loadSubmissionData = async () => {
    if (!assignment || !studentId) return;

    console.log('🔍 GradingInterface: Starting loadSubmissionData');
    console.log('🔍 GradingInterface: Assignment ID:', assignment.id);
    console.log('🔍 GradingInterface: Student ID:', studentId);

    setLoading(true);
    try {
      // Load student info
      console.log('🔍 GradingInterface: Loading student data...');
      const { data: studentData, error: studentError } = await supabase
        .from('student_assignment_progress')
        .select('*')
        .eq('assignment_id', assignment.id)
        .eq('student_id', studentId)
        .single();

      if (studentError) {
        console.error('❌ GradingInterface: Error loading student data:', studentError);
        console.error('❌ GradingInterface: Student error details:', {
          message: studentError.message,
          details: studentError.details,
          hint: studentError.hint,
          code: studentError.code
        });
        toast.error('Failed to load student information');
        return;
      }

      console.log('✅ GradingInterface: Student data loaded:', studentData);
      setStudent(studentData);

      // Load submission data
      console.log('🔍 GradingInterface: Loading submission data...');
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignment.id)
        .eq('user_id', studentId)
        .single();

      if (submissionError && submissionError.code !== 'PGRST116') {
        console.error('❌ GradingInterface: Error loading submission:', submissionError);
        console.error('❌ GradingInterface: Submission error details:', {
          message: submissionError.message,
          details: submissionError.details,
          hint: submissionError.hint,
          code: submissionError.code
        });
        toast.error('Failed to load submission data');
        return;
      }

      if (submissionData) {
        console.log('✅ GradingInterface: Submission data loaded:', submissionData);
        setSubmission(submissionData);
        setValue('score', submissionData.score || 0);
        setValue('feedback', submissionData.feedback || '');
      } else {
        console.log('🔍 GradingInterface: No submission found for this student');
      }
    } catch (error) {
      console.error('❌ GradingInterface: Exception in loadSubmissionData:', error);
      toast.error('Failed to load submission data');
    } finally {
      setLoading(false);
      console.log('🔍 GradingInterface: loadSubmissionData completed');
    }
  };

  if (!assignment || !studentId) {
    console.log('🔍 GradingInterface: Missing assignment or studentId');
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Submission not found</h3>
          <p className="text-muted-foreground">The requested submission could not be loaded.</p>
          <Button onClick={onBack} className="mt-4">
            Back to Submissions
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: GradingFormData) => {
    console.log('🔍 GradingInterface: Starting form submission');
    console.log('🔍 GradingInterface: Form data:', data);
    console.log('🔍 GradingInterface: Current user:', user);
    console.log('🔍 GradingInterface: Assignment:', assignment);
    console.log('🔍 GradingInterface: Student ID:', studentId);

    if (!user || !assignment || !studentId) {
      console.error('❌ GradingInterface: Missing required information');
      toast.error('Missing required information for grading');
      return;
    }

    setSubmitting(true);
    
    try {
      const submissionData = {
        score: data.score,
        feedback: data.feedback,
        status: data.status,
        graded_by: user.id,
        graded_at: new Date().toISOString()
      };

      console.log('🔍 GradingInterface: Submission data to save:', submissionData);

      if (submission) {
        console.log('🔍 GradingInterface: Updating existing submission:', submission.id);
        // Update existing submission
        const { error } = await supabase
          .from('submissions')
          .update(submissionData)
          .eq('id', submission.id);

        if (error) {
          console.error('❌ GradingInterface: Error updating submission:', error);
          console.error('❌ GradingInterface: Update error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          toast.error('Failed to save grade. Please try again.');
          return;
        }

        console.log('✅ GradingInterface: Submission updated successfully');
      } else {
        console.log('🔍 GradingInterface: Creating new submission record');
        // Create new submission record (for cases where student hasn't submitted but teacher wants to record a grade)
        const newSubmissionData = {
          assignment_id: assignment.id,
          user_id: studentId,
          ...submissionData,
          status: data.status
        };

        console.log('🔍 GradingInterface: New submission data:', newSubmissionData);

        const { error } = await supabase
          .from('submissions')
          .insert(newSubmissionData);

        if (error) {
          console.error('❌ GradingInterface: Error creating submission:', error);
          console.error('❌ GradingInterface: Insert error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          toast.error('Failed to save grade. Please try again.');
          return;
        }

        console.log('✅ GradingInterface: New submission created successfully');
      }

      toast.success(`Grade ${data.status === 'graded' ? 'saved' : 'submitted and returned'} successfully!`);
      onGradeSubmitted();
    } catch (error) {
      console.error('❌ GradingInterface: Exception during form submission:', error);
      toast.error('Failed to save grade. Please try again.');
    } finally {
      setSubmitting(false);
      console.log('🔍 GradingInterface: Form submission completed');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'graded':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'late':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isLateSubmission = student?.submission_status === 'late' || 
    (student?.submitted_at && new Date(student.submitted_at) > new Date(assignment.due_date));

  // Placeholder submission content
  const getSubmissionContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }

    if (!submission) {
      return (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No submission found for this student.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {submission.file_url && (
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Submitted File</h4>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">File submission</span>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        )}
        
        {submission.answer_text && (
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Text Response</h4>
            <div className="bg-muted/50 p-3 rounded">
              <p className="text-foreground whitespace-pre-wrap">{submission.answer_text}</p>
            </div>
          </div>
        )}

        {!submission.file_url && !submission.answer_text && (
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Submission Content</h4>
            <div className="bg-muted/50 p-3 rounded">
              <p className="text-muted-foreground text-center py-8">
                No content available for this submission.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => {
            console.log('🔍 GradingInterface: Returning to submissions list');
            onBack();
          }}
          className="mb-4 hover:bg-muted/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Submissions
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grade Submission</h1>
            <p className="text-muted-foreground">
              {assignment.title} • {assignment.course_title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              assignment.type === 'quiz' ? 'bg-blue-100 text-blue-800 border-blue-200' :
              assignment.type === 'assignment' ? 'bg-purple-100 text-purple-800 border-purple-200' :
              'bg-red-100 text-red-800 border-red-200'
            }>
              {assignment.type}
            </Badge>
            {isLateSubmission && (
              <Badge variant="destructive">
                Late Submission
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Info & Submission */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Information */}
          <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold text-lg">
                    {student?.student_name.split(' ').map(n => n[0]).join('') || 'S'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{student?.student_name || 'Unknown Student'}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due: {new Date(assignment.due_date).toLocaleDateString()}
                    </span>
                    {student?.submitted_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Submitted: {new Date(student.submitted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {student && (
                  <Badge variant="outline" className={getSubmissionStatusColor(student.submission_status)}>
                    {student.submission_status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submission Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Submission Content
              </CardTitle>
              <CardDescription>
                Review the student's submission before grading
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getSubmissionContent()}
            </CardContent>
          </Card>
        </div>

        {/* Grading Panel */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Grade Assignment
              </CardTitle>
              <CardDescription>
                Enter score and feedback for this submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Score Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Score (out of {assignment.max_score}) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={assignment.max_score}
                    step="0.1"
                    placeholder="Enter score..."
                    {...register('score', { 
                      required: 'Score is required',
                      min: { value: 0, message: 'Score cannot be negative' },
                      max: { value: assignment.max_score, message: `Score cannot exceed ${assignment.max_score}` },
                      valueAsNumber: true
                    })}
                    className="border-primary/20 focus:ring-primary"
                  />
                  {errors.score && (
                    <p className="text-sm text-destructive">{errors.score.message}</p>
                  )}
                  {watchedScore !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getScoreColor((watchedScore / assignment.max_score) * 100)}`}>
                        {((watchedScore / assignment.max_score) * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {((watchedScore / assignment.max_score) * 100) >= 90 ? 'Excellent' :
                         ((watchedScore / assignment.max_score) * 100) >= 80 ? 'Good' :
                         ((watchedScore / assignment.max_score) * 100) >= 70 ? 'Satisfactory' :
                         ((watchedScore / assignment.max_score) * 100) >= 60 ? 'Needs Improvement' : 'Unsatisfactory'}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Feedback */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Feedback for Student
                  </label>
                  <Textarea
                    placeholder="Provide detailed feedback to help the student improve..."
                    rows={6}
                    {...register('feedback')}
                    className="border-primary/20 focus:ring-primary resize-none"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Provide constructive feedback</span>
                    <span>{watchedFeedback?.length || 0} characters</span>
                  </div>
                </div>

                <Separator />

                {/* Quick Feedback Templates */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Quick Feedback Templates
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Excellent work! Your solution demonstrates a clear understanding of the concepts.",
                      "Good effort. Consider reviewing the algorithm complexity for optimization.",
                      "Your implementation is correct, but the code could be more readable with better comments.",
                      "Please review the requirements and resubmit with the missing components."
                    ].map((template, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-left h-auto p-2 text-xs"
                        onClick={() => {
                          const currentFeedback = watch('feedback');
                          const newFeedback = currentFeedback ? `${currentFeedback}\n\n${template}` : template;
                          setValue('feedback', newFeedback);
                        }}
                      >
                        {template}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    onClick={() => setValue('status', 'graded')}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {submitting ? 'Saving...' : 'Save Grade'}
                  </Button>
                  
                  <Button 
                    type="submit" 
                    variant="outline"
                    disabled={submitting}
                    className="w-full"
                    onClick={() => setValue('status', 'returned')}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {submitting ? 'Returning...' : 'Save & Return to Student'}
                  </Button>
                </div>

                {/* Grading Notes */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Save Grade:</strong> Saves your grade and feedback but keeps it private from the student.
                    <br />
                    <strong>Save & Return:</strong> Saves and immediately releases the grade and feedback to the student.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GradingInterface;