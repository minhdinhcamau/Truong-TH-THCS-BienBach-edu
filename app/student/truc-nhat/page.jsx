'use client';
import DutyMapView from '@/components/DutyMapView';

// Học sinh xem bản đồ trực nhật (chỉ các tuần Tổng phụ trách đã công bố); lớp mình được tô nổi bật.
export default function StudentDutyMapPage() {
  return <DutyMapView accent="#3b82c4" title="Trực nhật" />;
}
