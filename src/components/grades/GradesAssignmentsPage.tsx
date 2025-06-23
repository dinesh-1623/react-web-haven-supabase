import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardCheck, 
  Search, 
  Plus, 
  Users, 
  BookOpen, 
  TrendingUp, 
  Clock,
  MoreVertical,
  FileText,
  Calendar,
  ArrowUpDown,
  LogOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import CreateAssignmentQuizDialog from './CreateAssignmentQuizDialog';
import StudentSubmissionList from './StudentSubmissionList';
import GradingInterface from './GradingInterface';

interface Assignment {
  id: string;
  title: string;
  course_title: string;
  course_id: string;
  due_date: string;
  total_submissions: number;
  graded_submissions: number;
  pending_submissions: number;
  average_score: number;
  late_submissions: number;
  status: 'active' | 'closed' | 'draft';
  type: 'quiz' | 'assignment' | 'exam';
  max_score: number;
  description?: string;
}

interface Student {
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

interface Course {
  id: string;
  title: string;
  code?: string;
}

const GradesAssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date');
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { user, profile, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    console.log('🔍 GradesAssignmentsPage: useEffect triggered');
    console.log('🔍 GradesAssignmentsPage: authLoading:', authLoading);
    console.log('🔍 GradesAssignmentsPage: user:', user);
    console.log('🔍 GradesAssignmentsPage: profile:', profile);
    
    // Guard: Only proceed if auth is not loading and both user and profile are available
    if (authLoading) {
      console.log('🔍 GradesAssignmentsPage: Auth still loading, waiting...');
      return;
    }

    if (!user || !profile) {
      console.log('🔍 GradesAssignmentsPage: User or profile not available, skipping data fetch');
      setLoading(false);
      return;
    }

    console.log('🔍 GradesAssignmentsPage: Both user and profile loaded, proceeding with data fetch');
    loadAssignments();
    loadCourses();
  }, [user, profile, authLoading]);

  const loadAssignments = async () => {
    // Double-check that we have the required data
    if (!user || !profile) {
      console.log('🔍 GradesAssignmentsPage: loadAssignments called without user/profile, aborting');
      return;
    }
    
    console.log('🔍 GradesAssignmentsPage: Starting loadAssignments');
    console.log('🔍 GradesAssignmentsPage: Profile ID:', profile.id);
    console.log('🔍 GradesAssignmentsPage: Profile role:', profile.role);
    
    setLoading(true);
    try {
      let query = supabase
        .from('assignment_stats')
        .select('*');

      // Filter by instructor using profile.id instead of user.id
      if (profile.role === 'teacher') {
        console.log('🔍 GradesAssignmentsPage: Filtering assignments by instructor_id:', profile.id);
        query = query.eq('instructor_id', profile.id);
      }

      console.log('🔍 GradesAssignmentsPage: Executing assignment query...');
      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) {
        console.error('❌ GradesAssignmentsPage: Error loading assignments:', error);
        toast.error('Failed to load assignments');
        return;
      }

      console.log('✅ GradesAssignmentsPage: Raw assignment data received:', data);
      console.log('🔍 GradesAssignmentsPage: Number of assignments:', data?.length || 0);

      // Transform the data to match our interface
      const transformedAssignments: Assignment[] = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        course_title: item.course_title || 'Unknown Course',
        course_id: item.course_id,
        due_date: item.due_date,
        total_submissions: item.total_submissions || 0,
        graded_submissions: item.graded_submissions || 0,
        pending_submissions: item.pending_submissions || 0,
        average_score: item.average_score || 0,
        late_submissions: item.late_submissions || 0,
        status: item.status === 'published' ? 'active' : item.status === 'archived' ? 'closed' : 'draft',
        type: item.type,
        max_score: item.max_score,
        description: item.description
      }));

      console.log('✅ GradesAssignmentsPage: Transformed assignments:', transformedAssignments);
      setAssignments(transformedAssignments);
    } catch (error) {
      console.error('❌ GradesAssignmentsPage: Exception in loadAssignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
      console.log('🔍 GradesAssignmentsPage: loadAssignments completed');
    }
  };

  const loadCourses = async () => {
    // Double-check that we have the required data
    if (!user || !profile) {
      console.log('🔍 GradesAssignmentsPage: loadCourses called without user/profile, aborting');
      return;
    }

    console.log('🔍 GradesAssignmentsPage: Starting loadCourses');
    console.log('🔍 GradesAssignmentsPage: Profile ID:', profile.id);
    console.log('🔍 GradesAssignmentsPage: Profile role:', profile.role);

    try {
      let query = supabase
        .from('courses')
        .select('id, title');

      // Filter by instructor using profile.id instead of user.id
      if (profile.role === 'teacher') {
        console.log('🔍 GradesAssignmentsPage: Filtering courses by instructor_id:', profile.id);
        query = query.eq('instructor_id', profile.id);
      }

      console.log('🔍 GradesAssignmentsPage: Executing courses query...');
      const { data, error } = await query.order('title');

      if (error) {
        console.error('❌ GradesAssignmentsPage: Error loading courses:', error);
        toast.error('Failed to load courses');
        return;
      }

      console.log('✅ GradesAssignmentsPage: Raw courses data received:', data);
      console.log('🔍 GradesAssignmentsPage: Number of courses:', data?.length || 0);

      // Transform data to include a code field (using first 3 letters of title as fallback)
      const transformedCourses: Course[] = (data || []).map(course => ({
        id: course.id,
        title: course.title,
        code: course.title.substring(0, 3).toUpperCase()
      }));

      console.log('✅ GradesAssignmentsPage: Transformed courses:', transformedCourses);
      setCourses(transformedCourses);
    } catch (error) {
      console.error('❌ GradesAssignmentsPage: Exception in loadCourses:', error);
      toast.error('Failed to load courses');
    }
    console.log('🔍 GradesAssignmentsPage: loadCourses completed');
  };

  const handleSignOut = async () => {
    console.log('🔍 GradesAssignmentsPage: Sign out requested');
    await signOut();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quiz':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assignment':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'exam':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         assignment.course_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || assignment.status === filterStatus;
    const matchesType = filterType === 'all' || assignment.type === filterType;
    const matchesCourse = filterCourse === 'all' || assignment.course_id === filterCourse;
    
    return matchesSearch && matchesStatus && matchesType && matchesCourse;
  });

  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    switch (sortBy) {
      case 'due_date':
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      case 'created':
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime(); // Using due_date as proxy
      case 'title':
        return a.title.localeCompare(b.title);
      case 'submissions':
        return b.total_submissions - a.total_submissions;
      case 'pending':
        return b.pending_submissions - a.pending_submissions;
      default:
        return 0;
    }
  });

  const totalAssignments = assignments.length;
  const activeAssignments = assignments.filter(a => a.status === 'active').length;
  const pendingGrading = assignments.reduce((sum, a) => sum + a.pending_submissions, 0);
  const averageScore = assignments.length > 0 
    ? assignments.reduce((sum, a) => sum + a.average_score, 0) / assignments.length 
    : 0;

  const handleAssignmentCreated = (assignmentId: string) => {
    console.log('🔍 GradesAssignmentsPage: Assignment created with ID:', assignmentId);
    setShowCreateDialog(false);
    loadAssignments(); // Reload assignments
    toast.success('Assignment created successfully!');
  };

  // Show loading while auth is loading or user/profile are not available
  if (authLoading || !user || !profile) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Grade Assignments</h1>
              <p className="text-muted-foreground">Loading your assignments...</p>
            </div>
          </div>
        </div>
        <p className="text-center py-12 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show grading interface if a submission is selected
  if (selectedSubmission) {
    console.log('🔍 GradesAssignmentsPage: Showing grading interface for submission:', selectedSubmission);
    console.log('🔍 GradesAssignmentsPage: Selected assignment:', selectedAssignment);
    
    const assignment = assignments.find(a => a.id === selectedAssignment);
    
    return (
      <GradingInterface
        assignment={assignment}
        studentId={selectedSubmission}
        onBack={() => {
          console.log('🔍 GradesAssignmentsPage: Returning from grading interface');
          setSelectedSubmission(null);
        }}
        onGradeSubmitted={() => {
          console.log('🔍 GradesAssignmentsPage: Grade submitted, returning to list');
          setSelectedSubmission(null);
          loadAssignments(); // Reload to update stats
        }}
      />
    );
  }

  // Show student submissions if an assignment is selected
  if (selectedAssignment) {
    console.log('🔍 GradesAssignmentsPage: Showing student submissions for assignment:', selectedAssignment);
    
    const assignment = assignments.find(a => a.id === selectedAssignment);
    
    return (
      <StudentSubmissionList
        assignment={assignment}
        onBack={() => {
          console.log('🔍 GradesAssignmentsPage: Returning from student submissions');
          setSelectedAssignment(null);
        }}
        onGradeStudent={(studentId) => {
          console.log('🔍 GradesAssignmentsPage: Grading student:', studentId);
          setSelectedSubmission(studentId);
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grade Assignments</h1>
            <p className="text-muted-foreground">
              Manage quizzes, assignments, and exams for your courses
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={handleSignOut}
              className="hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Button 
              onClick={() => {
                console.log('🔍 GradesAssignmentsPage: Opening create assignment dialog');
                setShowCreateDialog(true);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Assignment
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card hover:shadow-card-hover transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Assignments</p>
                <p className="text-2xl font-bold text-foreground">{totalAssignments}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card hover:shadow-card-hover transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-foreground">{activeAssignments}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card hover:shadow-card-hover transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Grading</p>
                <p className="text-2xl font-bold text-foreground">{pendingGrading}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card hover:shadow-card-hover transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Score</p>
                <p className="text-2xl font-bold text-foreground">{averageScore.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-primary/20 focus:ring-primary"
              />
            </div>
            
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="created">Created Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="submissions">Submissions</SelectItem>
                <SelectItem value="pending">Pending Grading</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Assignments ({sortedAssignments.length})
          </CardTitle>
          <CardDescription>
            Click on an assignment to view and grade student submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedAssignments.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assignments found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all' || filterCourse !== 'all'
                  ? 'Try adjusting your filters to see more assignments.'
                  : 'Create your first assignment to get started.'
                }
              </p>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Assignment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAssignments.map((assignment) => {
                const isOverdue = new Date(assignment.due_date) < new Date() && assignment.status === 'active';
                
                return (
                  <div 
                    key={assignment.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-all duration-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5"
                    onClick={() => {
                      console.log('🔍 GradesAssignmentsPage: Assignment clicked:', assignment.id);
                      setSelectedAssignment(assignment.id);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        assignment.type === 'quiz' ? 'bg-blue-100' :
                        assignment.type === 'assignment' ? 'bg-purple-100' :
                        'bg-red-100'
                      }`}>
                        {assignment.type === 'quiz' ? (
                          <ClipboardCheck className="h-6 w-6 text-blue-600" />
                        ) : assignment.type === 'assignment' ? (
                          <FileText className="h-6 w-6 text-purple-600" />
                        ) : (
                          <BookOpen className="h-6 w-6 text-red-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                          {assignment.pending_submissions > 0 && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                              {assignment.pending_submissions} pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {assignment.course_title}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(assignment.due_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {assignment.total_submissions} submissions
                          </span>
                          <span className="flex items-center gap-1">
                            <ClipboardCheck className="h-3 w-3" />
                            {assignment.graded_submissions} graded
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{assignment.average_score.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Average</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getTypeColor(assignment.type)}>
                          {assignment.type}
                        </Badge>
                        <Badge variant="outline" className={getStatusColor(assignment.status)}>
                          {assignment.status}
                        </Badge>
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAssignmentQuizDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        courses={courses}
        onAssignmentCreated={handleAssignmentCreated}
      />
    </div>
  );
};

export default GradesAssignmentsPage;