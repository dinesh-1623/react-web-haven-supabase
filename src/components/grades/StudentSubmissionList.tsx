import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Users, 
  Search, 
  Eye, 
  Edit, 
  Download, 
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  title: string;
  course_title: string;
  due_date: string;
  total_submissions: number;
  graded_submissions: number;
  pending_submissions: number;
  average_score: number;
  status: 'active' | 'closed' | 'draft';
  type: 'quiz' | 'assignment' | 'exam';
  description?: string;
  max_score: number;
}

interface StudentSubmission {
  student_id: string;
  student_name: string;
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  due_date: string;
  max_score: number;
  submission_status: 'not_submitted' | 'submitted' | 'late' | 'graded';
  score?: number;
  submitted_at?: string;
  graded_at?: string;
  progress_status: string;
}

interface StudentSubmissionListProps {
  assignment: Assignment | undefined;
  onBack: () => void;
  onGradeStudent: (studentId: string) => void;
}

const StudentSubmissionList: React.FC<StudentSubmissionListProps> = ({
  assignment,
  onBack,
  onGradeStudent
}) => {
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  useEffect(() => {
    console.log('🔍 StudentSubmissionList: Component mounted');
    console.log('🔍 StudentSubmissionList: Assignment:', assignment);
    
    if (assignment) {
      loadStudentSubmissions();
    }
  }, [assignment]);

  const loadStudentSubmissions = async () => {
    if (!assignment) return;

    console.log('🔍 StudentSubmissionList: Starting loadStudentSubmissions');
    console.log('🔍 StudentSubmissionList: Assignment ID:', assignment.id);

    setLoading(true);
    try {
      console.log('🔍 StudentSubmissionList: Executing Supabase query...');
      const { data, error } = await supabase
        .from('student_assignment_progress')
        .select('*')
        .eq('assignment_id', assignment.id)
        .order('student_name');

      if (error) {
        console.error('❌ StudentSubmissionList: Error loading student submissions:', error);
        console.error('❌ StudentSubmissionList: Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error('Failed to load student submissions');
        return;
      }

      console.log('✅ StudentSubmissionList: Raw student submissions data:', data);
      console.log('🔍 StudentSubmissionList: Number of students:', data?.length || 0);

      setStudents(data || []);
    } catch (error) {
      console.error('❌ StudentSubmissionList: Exception in loadStudentSubmissions:', error);
      toast.error('Failed to load student submissions');
    } finally {
      setLoading(false);
      console.log('🔍 StudentSubmissionList: loadStudentSubmissions completed');
    }
  };

  if (!assignment) {
    console.log('🔍 StudentSubmissionList: No assignment provided');
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Assignment not found</h3>
          <p className="text-muted-foreground">The requested assignment could not be loaded.</p>
          <Button onClick={onBack} className="mt-4">
            Back to Assignments
          </Button>
        </div>
      </div>
    );
  }

  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'graded':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'late':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'not_submitted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSubmissionIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <FileText className="h-4 w-4" />;
      case 'graded':
        return <CheckCircle className="h-4 w-4" />;
      case 'late':
        return <AlertCircle className="h-4 w-4" />;
      case 'not_submitted':
        return <Clock className="h-4 w-4" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || student.submission_status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.student_name.localeCompare(b.student_name);
      case 'status':
        return a.submission_status.localeCompare(b.submission_status);
      case 'score':
        return (b.score || 0) - (a.score || 0);
      case 'submitted':
        if (!a.submitted_at && !b.submitted_at) return 0;
        if (!a.submitted_at) return 1;
        if (!b.submitted_at) return -1;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      default:
        return 0;
    }
  });

  const submittedCount = students.filter(s => s.submission_status === 'submitted' || s.submission_status === 'graded' || s.submission_status === 'late').length;
  const gradedCount = students.filter(s => s.submission_status === 'graded').length;
  const pendingCount = students.filter(s => s.submission_status === 'submitted' || s.submission_status === 'late').length;
  const averageScore = gradedCount > 0 
    ? students.filter(s => s.score !== undefined).reduce((sum, s) => sum + (s.score || 0), 0) / gradedCount 
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => {
            console.log('🔍 StudentSubmissionList: Returning to assignments list');
            onBack();
          }}
          className="mb-4 hover:bg-muted/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assignments
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{assignment.title}</h1>
            <p className="text-muted-foreground">
              Grade submissions and provide feedback • {assignment.course_title}
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
            <Badge variant="outline" className={
              assignment.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' :
              assignment.status === 'closed' ? 'bg-gray-100 text-gray-800 border-gray-200' :
              'bg-yellow-100 text-yellow-800 border-yellow-200'
            }>
              {assignment.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Assignment Details */}
      {assignment.description && (
        <Card className="mb-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <p className="text-foreground leading-relaxed">{assignment.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Due: {new Date(assignment.due_date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(assignment.due_date) > new Date() ? 'Active' : 'Past Due'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-foreground">{students.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold text-foreground">{submittedCount}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Grading</p>
                <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold text-foreground">{averageScore.toFixed(1)}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-primary/20 focus:ring-primary"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="not_submitted">Not Submitted</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="submitted">Submission Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Student Submissions */}
      <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Submissions ({sortedStudents.length})
          </CardTitle>
          <CardDescription>
            Review and grade student submissions for this assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No students found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterStatus !== 'all' 
                  ? 'Try adjusting your filters to see more students.'
                  : 'No students are enrolled in this assignment.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedStudents.map((student) => (
                <div 
                  key={student.student_id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-all duration-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold">
                        {student.student_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{student.student_name}</p>
                      {student.submitted_at && (
                        <p className="text-xs text-muted-foreground">
                          Submitted {formatDistanceToNow(new Date(student.submitted_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <Badge variant="outline" className={getSubmissionStatusColor(student.submission_status)}>
                        <span className="flex items-center gap-1">
                          {getSubmissionIcon(student.submission_status)}
                          {student.submission_status.replace('_', ' ')}
                        </span>
                      </Badge>
                      {student.score !== undefined && (
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {student.score}%
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {(student.submission_status === 'submitted' || student.submission_status === 'graded' || student.submission_status === 'late') && (
                        <>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {assignment.type === 'assignment' && (
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          )}
                        </>
                      )}
                      
                      {(student.submission_status === 'submitted' || student.submission_status === 'late') && (
                        <Button 
                          size="sm" 
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => {
                            console.log('🔍 StudentSubmissionList: Grading student:', student.student_id);
                            onGradeStudent(student.student_id);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Grade
                        </Button>
                      )}
                      
                      {student.submission_status === 'graded' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            console.log('🔍 StudentSubmissionList: Editing grade for student:', student.student_id);
                            onGradeStudent(student.student_id);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Grade
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentSubmissionList;