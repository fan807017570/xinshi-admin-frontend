<template>
  <section class="scores-page page">
    <header class="academic-page-header scores-page-header">
      <div class="academic-page-header__copy">
        <p class="eyebrow">教务工作流 · 02</p>
        <h1>成绩管理</h1>
        <p class="lead">{{ teacherMode ? '任课老师可以按学生、科目和学期录入与维护自己负责课程的成绩。' : '默认聚焦当前学生的数学成绩，班主任可以录入、修改各科成绩和班主任评价。' }}</p>
        <div v-if="auth.isDualRoleTeacher" class="workspace-tabs">
          <button
            class="tab-button"
            :class="{ active: workspaceTab === 'teacher' }"
            type="button"
            @click="switchToTeacher"
          >任课老师工作台</button>
          <button
            class="tab-button"
            :class="{ active: workspaceTab === 'headTeacher' }"
            type="button"
            @click="switchToHeadTeacher"
          >班主任工作台</button>
        </div>
      </div>
      <div class="score-header-status" aria-live="polite">
        <span>当前工作台</span>
        <strong>{{ teacherMode ? '任课教师' : '班主任' }}</strong>
      </div>
      <button class="button ghost" type="button" :disabled="loading" @click="loadPage">{{ loading ? '刷新中…' : '刷新数据' }}</button>
    </header>

    <AcademicWorkflowNav current="scores" :context="workflowContext" :context-text="workflowContextText" />

    <!-- ===== SUBJECT TEACHER WORKBENCH ===== -->
    <template v-if="teacherMode">
      <!-- Filter Panel -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>查询条件</h2>
            <p class="hint">默认展示当前学期中你负责课程下的所有学生，可按班级、科目和学生姓名筛选。</p>
          </div>
          <div class="action-group">
            <button class="button ghost" type="button" @click="resetTeacherQuery">重置</button>
          </div>
        </div>
        <form class="card-form compact score-query-form" @submit.prevent="searchTeacherEntries">
          <label class="score-query-field score-query-field--term"><span>学期</span><select id="teacher-term" v-model="teacherQuery.academicTermId" @change="onTeacherTermChange">
            <option value="">学期</option>
            <option v-for="term in terms" :key="term.id" :value="String(term.id)">{{ term.termName || term.name }}</option>
          </select></label>
          <label class="score-query-field score-query-field--session"><span>届次</span><select id="teacher-session" v-model="teacherQuery.gradeSession" @change="onTeacherSessionChange">
            <option value="">届次</option>
            <option v-for="session in gradeSessions" :key="session" :value="session">{{ session }}届</option>
          </select></label>
          <label class="score-query-field score-query-field--grade"><span>年级</span><select id="teacher-grade" v-model="teacherQuery.gradeLevel" @change="onTeacherGradeChange">
            <option value="">年级</option>
            <option v-for="level in availableGradeLevels(teacherQuery.gradeSession)" :key="level" :value="String(level)">{{ gradeLevelLabel(level) }}</option>
          </select></label>
          <label class="score-query-field score-query-field--class"><span>班级</span><select id="teacher-class" v-model="teacherQuery.classId" @change="onTeacherClassChange">
            <option value="">班级</option>
            <option v-for="klass in classes" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option>
          </select></label>
          <label class="score-query-field score-query-field--subject"><span>科目</span><select id="teacher-subject" v-model="teacherQuery.subjectId" @change="clearTeacherResults">
            <option value="">科目</option>
            <option v-for="subject in teacherSubjects" :key="subject.subjectId || subject.id" :value="String(subject.subjectId || subject.id)">{{ subject.subjectName || subject.name }}</option>
          </select></label>
          <label class="score-query-field score-query-field--exam"><span>考试类型</span><select id="teacher-exam" v-model="teacherQuery.examTypeId" @change="clearTeacherResults">
            <option value="">考试类型</option>
            <option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option>
          </select></label>
          <label class="score-query-field score-query-keyword"><span>学生</span><input v-model.trim="teacherKeyword" type="search" placeholder="输入姓名或学号" @input="onTeacherKeywordInput" /></label>
          <button class="button primary score-query-submit" type="submit">查询</button>
        </form>
        <p v-if="teacherContextError" class="context-error">{{ teacherContextError }}</p>
      </section>

      <section class="panel batch-panel">
        <div class="panel-head">
          <div>
            <h2>批量处理</h2>
            <p class="hint">先完整选择学期、届次、年级、班级、科目和考试类型，再导出或导入成绩。</p>
            <p class="batch-context">当前：{{ teacherContextSummary }}</p>
          </div>
          <div class="action-group">
            <button class="button" type="button" :disabled="exportLoading === 'teacher'" @click="exportTeacherTemplate">{{ exportLoading === 'teacher' ? '导出中...' : '导出成绩模版' }}</button>
            <button class="button primary" type="button" @click="showTeacherImportDialog">导入成绩</button>
          </div>
        </div>
      </section>

      <!-- Score Entries Table -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>我的成绩录入</h2>
            <p class="hint">未录入的成绩会显示为"待录入"，点击"录入"即可维护成绩和老师评价。支持通过 Excel 模版批量导入导出。</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>学期</th>
                <th>班级</th>
                <th>学生</th>
                <th>考试类型</th>
                <th>科目</th>
                <th>成绩</th>
                <th>评价</th>
                <th>优点</th>
                <th>改进点</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in teacherScoreRows" :key="teacherRowKey(row)">
                <td><span class="badge muted">{{ row.termName || '-' }}</span></td>
                <td>{{ row.className || '-' }}</td>
                <td>{{ row.studentName || '-' }}</td>
                <td><span class="badge muted">{{ row.examTypeName || '-' }}</span></td>
                <td>{{ row.subjectName || '-' }}</td>
                <td>
                  <strong v-if="row.hasScore" class="score-green">{{ row.score }}</strong>
                  <strong v-else class="score-red">待录入</strong>
                </td>
                <td class="score-comment-cell">
                  <span
                    class="score-comment-preview"
                    :aria-label="trimText(row.performanceComment)"
                    @mouseenter="showTooltip($event, row.performanceComment)"
                    @mousemove="moveTooltip"
                    @mouseleave="hideTooltip"
                  >{{ trimText(row.performanceComment) }}</span>
                </td>
                <td class="score-comment-cell">
                  <span
                    class="score-comment-preview"
                    :aria-label="trimText(row.strengths)"
                    @mouseenter="showTooltip($event, row.strengths)"
                    @mousemove="moveTooltip"
                    @mouseleave="hideTooltip"
                  >{{ trimText(row.strengths) }}</span>
                </td>
                <td class="score-comment-cell">
                  <span
                    class="score-comment-preview"
                    :aria-label="trimText(row.improvementPoints)"
                    @mouseenter="showTooltip($event, row.improvementPoints)"
                    @mousemove="moveTooltip"
                    @mouseleave="hideTooltip"
                  >{{ trimText(row.improvementPoints) }}</span>
                </td>
                <td>
                  <button class="button ghost sm" type="button" @click="openScoreModal(row)">
                    {{ row.hasScore ? '修改' : '录入' }}
                  </button>
                  <button v-if="row.hasScore" class="button ghost danger sm" type="button" @click="deleteScore(row)">删除</button>
                </td>
              </tr>
              <tr v-if="!teacherScoreRows.length">
                <td colspan="10" class="empty">暂无需要录入的成绩信息，请确认已为你配置任课班级和科目。</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <div class="pagination-left">
            <span class="pagination-info">共 {{ teacherTotal }} 条</span>
            <label class="pagination-size-label">
              每页
              <select v-model.number="teacherPage.size" class="pagination-size-select" @change="searchTeacherEntries">
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
              条
            </label>
          </div>
          <div class="pagination-buttons">
            <button class="button sm" type="button" :disabled="teacherPage.current <= 1" @click="goTeacherPage(teacherPage.current - 1)">上一页</button>
            <button v-for="num in teacherPageNumbers" :key="num" class="button sm" :class="{ primary: num === teacherPage.current }" type="button" @click="goTeacherPage(num)">{{ num }}</button>
            <button class="button sm" type="button" :disabled="teacherPage.current >= teacherPageCount" @click="goTeacherPage(teacherPage.current + 1)">下一页</button>
            <label class="pagination-jump">跳至 <input v-model.number="teacherPage.jump" type="number" min="1" :max="teacherPageCount" @keydown.enter.prevent="jumpTeacherPage" /> 页</label>
            <button class="button sm" type="button" @click="jumpTeacherPage">跳转</button>
          </div>
        </div>
      </section>
    </template>

    <!-- ===== HEAD TEACHER WORKBENCH ===== -->
    <template v-if="!teacherMode">
      <!-- Filter Panel -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>查询条件</h2>
            <p class="hint">选择学期和班级后可导出/导入综合评价与荣誉模版。选择学生后查看个人详情。</p>
          </div>
          <div class="action-group"><button class="button ghost" type="button" @click="resetHeadTeacherQuery">重置</button></div>
        </div>
        <form class="card-form compact score-query-form" @submit.prevent="searchHeadTeacherScores">
          <label class="score-query-field score-query-field--term"><span>学期</span><select id="head-term" v-model="headTeacherQuery.academicTermId" @change="onHeadTeacherTermChange">
            <option value="">学期</option>
            <option v-for="term in terms" :key="term.id" :value="String(term.id)">{{ term.termName || term.name }}</option>
          </select></label>
          <label class="score-query-field score-query-field--session"><span>届次</span><select id="head-session" v-model="headTeacherQuery.gradeSession" @change="onHeadTeacherSessionChange">
            <option value="">届次</option>
            <option v-for="session in gradeSessions" :key="session" :value="session">{{ session }}届</option>
          </select></label>
          <label class="score-query-field score-query-field--grade"><span>年级</span><select id="head-grade" v-model="headTeacherQuery.gradeLevel" @change="onHeadTeacherGradeChange">
            <option value="">年级</option>
            <option v-for="level in availableGradeLevels(headTeacherQuery.gradeSession)" :key="level" :value="String(level)">{{ gradeLevelLabel(level) }}</option>
          </select></label>
          <label class="score-query-field score-query-field--class"><span>班级</span><select id="head-class" v-model="headTeacherQuery.classId" @change="onHeadTeacherClassChange">
            <option value="">班级</option>
            <option v-for="klass in classes" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option>
          </select></label>
          <label class="score-query-field score-query-field--subject"><span>成绩科目</span><select id="head-subject" v-model="headTeacherGradeSubjectId">
            <option value="">成绩科目（导出成绩模版用）</option>
            <option v-for="subject in headTeacherSubjects" :key="subject.subjectId || subject.id" :value="String(subject.subjectId || subject.id)">{{ subject.subjectName || subject.name }}</option>
          </select></label>
          <label class="score-query-field score-query-field--exam"><span>考试类型</span><select id="head-exam" v-model="headTeacherQuery.examTypeId" @change="clearHeadTeacherDetails">
            <option value="">考试类型</option>
            <option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option>
          </select></label>
          <label class="score-query-field score-query-keyword"><span>学生</span><div class="student-search">
            <input
              v-model.trim="studentKeyword"
              type="search"
              :disabled="!headTeacherQuery.classId"
              :placeholder="headTeacherQuery.classId ? '输入学生姓名或学号，按回车选择第一个' : '请先选择班级'"
              @input="searchStudents"
              @focus="searchStudents"
              @keydown.enter.prevent="selectFirstStudent"
            />
            <div v-if="studentKeyword && !headTeacherQuery.studentId" class="student-suggestions">
              <button
                v-for="student in studentSuggestions"
                :key="student.id"
                type="button"
                @click="selectStudent(student)"
              >
                <strong>{{ student.studentName || student.name }}</strong>
                <span>{{ student.studentNo || '-' }} · {{ student.className || '当前班级' }}</span>
              </button>
              <p v-if="!studentSuggestions.length">没有匹配的学生</p>
            </div>
          </div></label>
          <button class="button primary score-query-submit" type="submit">查询</button>
        </form>
        <p v-if="headTeacherContextError" class="context-error">{{ headTeacherContextError }}</p>
      </section>

      <section class="panel batch-panel">
        <div class="panel-head">
          <div>
            <h2>批量处理</h2>
            <p class="hint">成绩与评语荣誉使用独立模版和导入入口，避免文件结构被错误解析。</p>
            <p class="batch-context">当前：{{ headTeacherContextSummary }}</p>
          </div>
          <div class="action-group">
            <button class="button" type="button" :disabled="exportLoading === 'headScore'" @click="exportHeadTeacherGradeTemplate">{{ exportLoading === 'headScore' ? '导出中...' : '导出成绩模版' }}</button>
            <button class="button primary" type="button" @click="showHeadTeacherScoreImportDialog">导入成绩</button>
            <button class="button" type="button" :disabled="exportLoading === 'parent'" @click="exportHeadTeacherTemplate">{{ exportLoading === 'parent' ? '导出中...' : '导出评语与荣誉模版' }}</button>
            <button class="button primary" type="button" @click="showHeadTeacherImportDialog">导入评语与荣誉</button>
          </div>
        </div>
      </section>

      <!-- Student Selected: Stats + Scores -->
      <template v-if="selectedStudent">
        <!-- Student Stat Grid -->
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>当前学生</h2>
              <p class="hint">当前页面已经锁定到这位学生的成绩，切换学生后会立即刷新。</p>
            </div>
            <div v-if="auth.canManageScores" class="action-group">
              <button class="button primary" type="button" @click="openScoreModal(null)">新增成绩</button>
              <button class="button" type="button" @click="goTranscripts">成绩单管理</button>
              <button class="button" type="button" :disabled="downloadingTranscript" @click="downloadHeadTeacherTranscript">
                {{ downloadingTranscript ? '生成并下载中...' : '生成并下载' }}
              </button>
            </div>
          </div>
          <div class="student-stat-grid">
            <div>
              <span class="metric-label">学生</span>
              <strong>{{ selectedStudent.studentName || selectedStudent.name || '-' }}</strong>
              <span class="metric-foot">{{ selectedStudent.studentNo || '-' }}</span>
            </div>
            <div>
              <span class="metric-label">班级</span>
              <strong>{{ selectedStudent.className || '-' }}</strong>
            </div>
            <div>
              <span class="metric-label">总分</span>
              <strong>{{ headTeacherQuery.examTypeId ? headTeacherTotalScore.toFixed(2) : '-' }}</strong>
              <span class="metric-foot">{{ headTeacherQuery.examTypeId ? '当前考试全部科目合计' : '选择考试类型后统计' }}</span>
            </div>
            <div>
              <span class="metric-label">课程数</span>
              <strong>{{ headTeacherScoreRows.length }}</strong>
              <span class="metric-foot">可录入科目</span>
            </div>
          </div>
        </section>

        <!-- Score Overview Table -->
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>成绩总览</h2>
              <p class="hint">列表展示当前学生各科成绩，点击"修改"后在弹窗中维护成绩和评价。</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>考试类型</th>
                  <th>科目</th>
                  <th>成绩</th>
                  <th>有效分数</th>
                  <th>课程表现</th>
                  <th>优点</th>
                  <th>改进点</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in headTeacherScoreRows" :key="headTeacherRowKey(row)">
                  <td><span class="badge muted">{{ row.examTypeName || '-' }}</span></td>
                  <td><strong>{{ row.subjectName || '-' }}</strong></td>
                  <td><strong class="score-green">{{ Number(row.score || 0).toFixed(2) }}</strong></td>
                  <td>{{ formatScoreRange(row) }}</td>
                  <td class="score-comment-cell">
                    <span
                      class="score-comment-preview"
                      :aria-label="trimText(row.performanceComment)"
                      @mouseenter="showTooltip($event, row.performanceComment)"
                      @mousemove="moveTooltip"
                      @mouseleave="hideTooltip"
                    >{{ trimText(row.performanceComment) }}</span>
                  </td>
                  <td class="score-comment-cell">
                    <span
                      class="score-comment-preview"
                      :aria-label="trimText(row.strengths)"
                      @mouseenter="showTooltip($event, row.strengths)"
                      @mousemove="moveTooltip"
                      @mouseleave="hideTooltip"
                    >{{ trimText(row.strengths) }}</span>
                  </td>
                  <td class="score-comment-cell">
                    <span
                      class="score-comment-preview"
                      :aria-label="trimText(row.improvementPoints)"
                      @mouseenter="showTooltip($event, row.improvementPoints)"
                      @mousemove="moveTooltip"
                      @mouseleave="hideTooltip"
                    >{{ trimText(row.improvementPoints) }}</span>
                  </td>
                  <td>
                    <button v-if="auth.canManageScores" class="button ghost sm" type="button" @click="openScoreModal(row)">修改</button>
                    <button v-if="auth.canManageScores" class="button ghost danger sm" type="button" @click="deleteScore(row)">删除</button>
                  </td>
                </tr>
                <tr v-if="!headTeacherScoreRows.length">
                  <td colspan="8" class="empty">暂无成绩信息，可点击"新增成绩"录入。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Overall Comment -->
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>班主任总体评价</h2>
              <p v-if="overallComments.length > 0" class="hint">由 {{ overallComments[0].evaluatorName || '班主任' }} 录入</p>
              <p v-else class="hint">尚未录入总体评价</p>
            </div>
            <div v-if="auth.canManageScores" class="action-group">
              <button class="button primary" type="button" @click="openOverallCommentModal">
                {{ overallComments.length > 0 ? '修改总体评价' : '新增总体评价' }}
              </button>
            </div>
          </div>
          <div v-if="overallComments.length > 0" class="overall-comment-display">
            <div class="comment-block">
              <span class="metric-label">总体评价</span>
              <p class="comment-text">{{ overallComments[0].overallComment || '-' }}</p>
            </div>
            <div v-if="overallComments[0].strengths" class="comment-block">
              <span class="metric-label">优点</span>
              <p class="comment-text">{{ overallComments[0].strengths }}</p>
            </div>
            <div v-if="overallComments[0].improvementPoints" class="comment-block">
              <span class="metric-label">改进点</span>
              <p class="comment-text">{{ overallComments[0].improvementPoints }}</p>
            </div>
          </div>
        </section>

        <!-- Student Honors / Achievements -->
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>学生荣誉成就</h2>
              <p v-if="achievements.length > 0" class="hint">共 {{ achievements.length }} 项荣誉记录</p>
              <p v-else class="hint">尚未录入荣誉成就</p>
            </div>
            <div v-if="auth.canManageScores" class="action-group">
              <button class="button primary" type="button" @click="openAchievementModal(null)">新增荣誉</button>
            </div>
          </div>
          <div v-if="achievements.length > 0">
            <div v-for="item in achievements" :key="item.id" class="achievement-row">
              <div class="achievement-row__content">
                <div class="achievement-row__summary">
                  <span v-if="item.honorTypeName" class="achievement-type">{{ item.honorTypeName }}</span>
                  <span class="achievement-text">{{ item.achievementText || '-' }}</span>
                </div>
              </div>
              <div v-if="auth.canManageScores" class="achievement-row__actions">
                <button class="button ghost sm" type="button" @click="openAchievementModal(item)">编辑</button>
                <button class="button ghost danger sm" type="button" @click="removeAchievement(item.id)">删除</button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- No Student Selected -->
      <section v-if="!selectedStudent" class="panel">
        <h2>请选择学生</h2>
        <p class="lead">先在上方查询条件里选择学生，然后再查看或录入成绩。</p>
      </section>
    </template>

    <p v-if="globalError" class="error">{{ globalError }}</p>

    <!-- ===== SCORE ENTRY/EDIT MODAL ===== -->
    <Teleport to="body">
      <div v-if="scoreModalVisible" class="modal-backdrop" @click.self="closeScoreModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="score-modal-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">成绩录入</p>
              <h2 id="score-modal-title">{{ scoreFormTitle }}</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeScoreModal">关闭</button>
          </div>
          <form class="score-editor" @submit.prevent="submitScore">
            <p v-if="scoreModalError" class="error">{{ scoreModalError }}</p>
            <div class="score-summary">
              <div>
                <span class="metric-label">学生</span>
                <strong>{{ scoreForm.studentName || selectedStudent?.studentName || selectedStudent?.name || '-' }}</strong>
              </div>
              <div>
                <span class="metric-label">班级</span>
                <strong>{{ scoreForm.className || selectedStudent?.className || '-' }}</strong>
              </div>
              <div>
                <span class="metric-label">录入人</span>
                <strong>{{ auth.user?.realName || '当前用户' }}</strong>
              </div>
            </div>
            <div class="score-form-grid">
              <label class="score-field-subject">
                <span>科目</span>
                <select v-model="scoreForm.subjectId" :disabled="scoreForm.isEdit" @change="onScoreSubjectChange">
                  <option value="">请选择科目</option>
                  <option v-for="cs in classSubjectOptions" :key="cs.subjectId || cs.id" :value="String(cs.subjectId || cs.id)">
                    {{ cs.subjectName || cs.name }}（{{ cs.minScore ?? 0 }}-{{ cs.maxScore ?? 100 }}分）
                  </option>
                </select>
              </label>
              <label class="score-field-exam">
                <span>考试类型</span>
                <select v-model="scoreForm.examTypeId">
                  <option value="">请选择考试类型（可选）</option>
                  <option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option>
                </select>
              </label>
              <label class="score-field-value">
                <span>成绩</span>
                <input v-model.number="scoreForm.score" type="number" :min="scoreForm.minScore" :max="scoreForm.maxScore" step="0.01" />
                <small>有效范围：{{ scoreForm.minScore }} - {{ scoreForm.maxScore }}</small>
              </label>
              <label class="full">
                <span>课程表现</span>
                <div class="textarea-with-polish">
                  <textarea v-model="scoreForm.performanceComment" rows="3" placeholder="描述这个科目的课堂表现、作业完成情况等"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'performanceComment'" @click="doPolish('performanceComment', scoreForm.performanceComment, scoreForm, 'performanceComment')" :title="polishingField === 'performanceComment' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'performanceComment' ? '…' : 'AI' }}</button>
                </div>
              </label>
              <label class="full">
                <span>做得好的地方</span>
                <div class="textarea-with-polish">
                  <textarea v-model="scoreForm.strengths" rows="3" placeholder="写下这个科目表现好的地方"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'strengths'" @click="doPolish('strengths', scoreForm.strengths, scoreForm, 'strengths')" :title="polishingField === 'strengths' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'strengths' ? '…' : 'AI' }}</button>
                </div>
              </label>
              <label class="full">
                <span>需要改进的点</span>
                <div class="textarea-with-polish">
                  <textarea v-model="scoreForm.improvementPoints" rows="3" placeholder="写下这个科目需要改进的地方"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'improvementPoints'" @click="doPolish('improvementPoints', scoreForm.improvementPoints, scoreForm, 'improvementPoints')" :title="polishingField === 'improvementPoints' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'improvementPoints' ? '…' : 'AI' }}</button>
                </div>
              </label>
            </div>
            <div class="modal-actions">
              <button class="button ghost sm" type="button" @click="closeScoreModal">取消</button>
              <button class="button primary sm" type="submit">保存成绩</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <!-- ===== OVERALL COMMENT MODAL ===== -->
    <Teleport to="body">
      <div v-if="overallCommentModalVisible" class="modal-backdrop" @click.self="closeOverallCommentModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="overall-comment-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">总体评价</p>
              <h2 id="overall-comment-title">新增班主任总体评价</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeOverallCommentModal">关闭</button>
          </div>
          <form class="score-editor" @submit.prevent="submitOverallComment">
            <p v-if="overallCommentModalError" class="error">{{ overallCommentModalError }}</p>
            <div class="score-summary">
              <div>
                <span class="metric-label">学生</span>
                <strong>{{ selectedStudent?.studentName || selectedStudent?.name || '-' }}</strong>
              </div>
              <div>
                <span class="metric-label">班级</span>
                <strong>{{ selectedStudent?.className || '-' }}</strong>
              </div>
              <div>
                <span class="metric-label">录入人</span>
                <strong>{{ auth.user?.realName || '当前用户' }}</strong>
              </div>
            </div>
            <div class="score-form-grid">
              <label class="full">
                <span>总体评价</span>
                <div class="textarea-with-polish">
                  <textarea v-model="overallCommentForm.overallComment" rows="4" placeholder="班主任对学生的总体评价"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'overallComment'" @click="doPolish('overallComment', overallCommentForm.overallComment, overallCommentForm, 'overallComment')" :title="polishingField === 'overallComment' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'overallComment' ? '…' : 'AI' }}</button>
                </div>
              </label>
              <label class="full">
                <span>做得好的地方</span>
                <div class="textarea-with-polish">
                  <textarea v-model="overallCommentForm.strengths" rows="3" placeholder="班主任对学生整体表现中的优点"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'overallStrengths'" @click="doPolish('overallStrengths', overallCommentForm.strengths, overallCommentForm, 'strengths')" :title="polishingField === 'overallStrengths' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'overallStrengths' ? '…' : 'AI' }}</button>
                </div>
              </label>
              <label class="full">
                <span>需要改进的点</span>
                <div class="textarea-with-polish">
                  <textarea v-model="overallCommentForm.improvementPoints" rows="3" placeholder="班主任对学生整体表现中的改进建议"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'overallImprovementPoints'" @click="doPolish('overallImprovementPoints', overallCommentForm.improvementPoints, overallCommentForm, 'improvementPoints')" :title="polishingField === 'overallImprovementPoints' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'overallImprovementPoints' ? '…' : 'AI' }}</button>
                </div>
              </label>
            </div>
            <div class="modal-actions">
              <button class="button ghost sm" type="button" @click="closeOverallCommentModal">取消</button>
              <button class="button primary sm" type="submit">保存总体评价</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <!-- ===== ACHIEVEMENT MODAL ===== -->
    <Teleport to="body">
      <div v-if="achievementModalVisible" class="modal-backdrop" @click.self="closeAchievementModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">{{ editingAchievement ? '编辑荣誉' : '新增荣誉' }}</p>
              <h2 id="achievement-modal-title">{{ editingAchievement ? '修改学生荣誉' : '录入学生荣誉' }}</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeAchievementModal">关闭</button>
          </div>
          <form class="score-editor" @submit.prevent="submitAchievement">
            <p v-if="achievementModalError" class="error">{{ achievementModalError }}</p>
            <div class="score-summary">
              <div>
                <span class="metric-label">学生</span>
                <strong>{{ selectedStudent?.studentName || selectedStudent?.name || '-' }}</strong>
              </div>
              <div>
                <span class="metric-label">学期</span>
                <strong>{{ currentTermName }}</strong>
              </div>
            </div>
            <div class="achievement-form-fields">
              <div class="achievement-field">
                <label for="achievement-type">荣誉类型</label>
                <select id="achievement-type" v-model="achievementForm.honorTypeId">
                  <option value="">请选择荣誉类型（可选）</option>
                  <option v-for="type in honorTypes" :key="type.id" :value="String(type.id)">{{ type.honorTypeName || type.name }}</option>
                </select>
              </div>
              <div class="achievement-field">
                <label for="achievement-content">荣誉详细内容</label>
                <textarea id="achievement-content" v-model="achievementForm.achievementText" rows="3" placeholder="描述该荣誉的具体内容..."></textarea>
              </div>
            </div>
            <div class="modal-actions achievement-actions">
              <button class="button ghost sm" type="button" @click="closeAchievementModal">取消</button>
              <button class="button primary sm" type="submit" :disabled="achievementSaving">{{ achievementSaving ? '保存中...' : '保存荣誉' }}</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <!-- ===== IMPORT DIALOG ===== -->
    <Teleport to="body">
      <div v-if="importDialogVisible" class="modal-backdrop" @click.self="closeImportDialog">
        <section class="modal-card import-modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h2>{{ importDialogTitle }}</h2>
            <button class="button ghost sm" type="button" @click="closeImportDialog">关闭</button>
          </div>
          <div class="import-content">
            <div class="import-steps">
              <span :class="{ active: importStep >= 1 }">1 选择上下文</span>
              <span :class="{ active: importStep >= 2 }">2 预校验</span>
              <span :class="{ active: importStep >= 3 }">3 确认导入</span>
            </div>

            <div class="import-context-grid">
              <label class="import-field-term"><span>学期</span><select id="import-term" v-model="importContext.academicTermId" @change="onImportTermChange"><option value="">请选择学期</option><option v-for="term in terms" :key="term.id" :value="String(term.id)">{{ term.termName || term.name }}</option></select><small v-if="importFieldErrors.academicTermId">{{ importFieldErrors.academicTermId }}</small></label>
              <label class="import-field-session"><span>届次</span><select id="import-session" v-model="importContext.gradeSession" @change="onImportSessionChange"><option value="">请选择届次</option><option v-for="session in gradeSessions" :key="session" :value="session">{{ session }}届</option></select><small v-if="importFieldErrors.gradeSession">{{ importFieldErrors.gradeSession }}</small></label>
              <label class="import-field-grade"><span>年级</span><select id="import-grade" v-model="importContext.gradeLevel" @change="onImportGradeChange"><option value="">请选择年级</option><option v-for="level in availableGradeLevels(importContext.gradeSession)" :key="level" :value="String(level)">{{ gradeLevelLabel(level) }}</option></select><small v-if="importFieldErrors.gradeLevel">{{ importFieldErrors.gradeLevel }}</small></label>
              <label class="import-field-class"><span>班级</span><select id="import-class" v-model="importContext.classId" @change="onImportClassChange"><option value="">请选择班级</option><option v-for="klass in importClasses" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option></select><small v-if="importFieldErrors.classId">{{ importFieldErrors.classId }}</small></label>
              <label v-if="isCourseImport" class="import-field-subject"><span>科目</span><select id="import-subject" v-model="importContext.subjectId" @change="invalidateImportPrecheck"><option value="">请选择科目</option><option v-for="subject in importSubjects" :key="subject.subjectId || subject.id" :value="String(subject.subjectId || subject.id)">{{ subject.subjectName || subject.name }}</option></select><small v-if="importFieldErrors.subjectId">{{ importFieldErrors.subjectId }}</small></label>
              <label v-if="isCourseImport" class="import-field-exam"><span>考试类型</span><select id="import-exam" v-model="importContext.examTypeId" @change="invalidateImportPrecheck"><option value="">请选择考试类型</option><option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option></select><small v-if="importFieldErrors.examTypeId">{{ importFieldErrors.examTypeId }}</small></label>
            </div>

            <label v-if="!isCourseImport" class="ai-toggle">
              <input type="checkbox" v-model="importEnableAiPolish" @change="invalidateImportPrecheck" />
              <div><strong>AI 润色评语</strong><small>预校验时自动优化总体评价、优点和改进点的文字表达</small></div>
            </label>

            <div v-if="importError" class="import-error-banner"><span>导入校验失败：{{ importError }}</span></div>

            <div>
              <p class="import-file-label">选择 Excel 文件（.xlsx）</p>
              <div class="import-file-row">
                <button class="button" type="button" @click="importFileInput?.click()">选择文件</button>
                <span v-if="importSelectedFile" class="import-file-name">{{ importSelectedFile.name }}</span>
                <span v-else class="import-file-empty">未选择文件</span>
                <input ref="importFileInput" class="visually-hidden-file" type="file" accept=".xlsx" @change="onImportFileSelected" />
              </div>
              <small v-if="importFieldErrors.file" class="field-error">{{ importFieldErrors.file }}</small>
            </div>

            <p v-if="importLoading" class="import-loading">{{ importStep === 3 ? '正在提交，文件将整体成功或整体回滚...' : '正在解析并预校验文件...' }}</p>

            <div v-if="importResult" class="import-result-card">
              <p class="import-result-title">{{ importCommitted ? '导入完成' : '预校验结果' }}</p>
              <div class="import-result-grid">
                <div><span class="metric-label">总行数</span><strong>{{ importResult.total || 0 }}</strong></div>
                <div v-if="importCommitted"><span class="metric-label">成功</span><strong class="result-success">{{ importResult.success || 0 }}</strong></div>
                <div v-else><span class="metric-label">预计新增</span><strong class="result-success">{{ importResult.creates || 0 }}</strong></div>
                <div v-if="!importCommitted"><span class="metric-label">预计更新</span><strong class="result-update">{{ importResult.updates || 0 }}</strong></div>
                <div><span class="metric-label">跳过</span><strong>{{ importResult.skipped || 0 }}</strong></div>
                <div><span class="metric-label">错误</span><strong class="result-error">{{ importResult.errorCount ?? importResult.failed ?? 0 }}</strong></div>
                <div v-if="importResult.aiPolished > 0"><span class="metric-label">AI 润色</span><strong>{{ importResult.aiPolished }} 条</strong></div>
              </div>
              <div v-if="importResult.errors && importResult.errors.length" class="import-error-list">
                <div class="error-list-head"><p>错误详情：</p><button class="button ghost sm" type="button" @click="downloadImportErrors">下载完整错误清单</button></div>
                <div v-for="(err, idx) in importResult.errors.slice(0, 20)" :key="idx" class="import-error-item">
                  {{ err.row ? `第${err.row}行` : '模版上下文' }} {{ err.studentNo || '' }} {{ err.studentName || '' }}：{{ err.reason }}
                </div>
                <p v-if="importResult.errors.length > 20" class="import-more-errors">... 还有 {{ importResult.errors.length - 20 }} 条错误未显示</p>
              </div>
            </div>

            <div class="import-actions">
              <button class="button ghost" type="button" @click="closeImportDialog">{{ importCommitted ? '关闭' : '取消' }}</button>
              <button v-if="!importCommitted" class="button" type="button" :disabled="importLoading" @click="precheckImport">{{ importLoading && importStep !== 3 ? '预校验中...' : '预校验' }}</button>
              <button v-if="!importCommitted" class="button primary" type="button" :disabled="!importToken || importLoading || Number(importResult?.errorCount || 0) > 0" @click="commitImport">{{ importLoading && importStep === 3 ? '提交中...' : '确认导入' }}</button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- ===== COMMENT TOOLTIP ===== -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="comment-tooltip"
        :style="{ left: tooltip.x + 'px', top: (tooltip.y + 16) + 'px' }"
      >{{ tooltip.text }}</div>
    </Teleport>

    <!-- ===== DOWNLOAD PROGRESS ===== -->
    <DownloadProgress :visible="downloadVisible" :percent="downloadPercent" @cancel="cancelHeadTeacherDownload" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AcademicWorkflowNav from '../components/AcademicWorkflowNav.vue'
import DownloadProgress from '../components/DownloadProgress.vue'
import * as schoolApi from '../api/school'
import { useAuthStore } from '../stores/auth'
import { useErrorStore } from '../stores/error'

type AnyRow = Record<string, any>

const auth = useAuthStore()
const errorStore = useErrorStore()
const route = useRoute()
const router = useRouter()

// ---- Workspace Tab ----
const workspaceTab = ref<'teacher' | 'headTeacher'>('headTeacher')

const teacherMode = computed(() => {
  if (auth.isSuperAdmin) return false
  if (auth.isDualRoleTeacher) return workspaceTab.value === 'teacher'
  return auth.isTeacher && !auth.isHeadTeacher
})

function switchToTeacher() {
  workspaceTab.value = 'teacher'
  headTeacherScoreRows.value = []
  overallComments.value = []
  achievements.value = []
  loadPage()
}

function switchToHeadTeacher() {
  workspaceTab.value = 'headTeacher'
  teacherScoreRows.value = []
  teacherTotal.value = 0
  loadPage()
}

// ---- Shared State ----
const loading = ref(false)
const globalError = ref('')
const terms = ref<AnyRow[]>([])
const classes = ref<AnyRow[]>([])
const subjects = ref<AnyRow[]>([])
const examTypes = ref<AnyRow[]>([])
const honorTypes = ref<AnyRow[]>([])
const classFilterOptions = ref<AnyRow>({ gradeSessions: [], gradeLevels: [], gradeOptions: [], combinations: [] })
const exportLoading = ref<'' | 'teacher' | 'headScore' | 'parent'>('')
const teacherContextError = ref('')
const headTeacherContextError = ref('')

const gradeSessions = computed<string[]>(() => classFilterOptions.value.gradeSessions || [])

function availableGradeLevels(gradeSession: string) {
  const combinations = classFilterOptions.value.combinations || []
  const levels = gradeSession
    ? combinations.filter((item: AnyRow) => item.gradeSession === gradeSession).map((item: AnyRow) => Number(item.gradeLevel))
    : (classFilterOptions.value.gradeLevels || []).map((item: any) => Number(item))
  return Array.from(new Set<number>(levels)).sort((a, b) => a - b)
}

function gradeLevelLabel(level: number) {
  const gradeOption = (classFilterOptions.value.gradeOptions || [])
    .find((item: AnyRow) => Number(item.gradeLevel) === Number(level))
  if (gradeOption?.gradeName) return String(gradeOption.gradeName)
  const combination = (classFilterOptions.value.combinations || [])
    .find((item: AnyRow) => Number(item.gradeLevel) === Number(level) && item.gradeName)
  return combination?.gradeName ? String(combination.gradeName) : `${level}年级`
}

function optionName(options: AnyRow[], id: string, idFields: string[], nameFields: string[]) {
  if (!id) return '未选择'
  const option = options.find((item) => idFields.some((field) => String(item[field] ?? '') === String(id)))
  if (!option) return id
  const field = nameFields.find((nameField) => option[nameField])
  return field ? String(option[field]) : id
}

function contextSummary(context: AnyRow, subjectId = '') {
  const term = optionName(terms.value, context.academicTermId, ['id'], ['termName', 'name'])
  const gradeSession = context.gradeSession ? `${context.gradeSession}届` : '届次未选择'
  const grade = context.gradeLevel ? gradeLevelLabel(Number(context.gradeLevel)) : '年级未选择'
  const klass = optionName(classes.value, context.classId, ['id'], ['className', 'name'])
  const parts = [term, gradeSession, grade, klass]
  if (subjectId || context.subjectId !== undefined) {
    parts.push(optionName(
      [...teacherSubjects.value, ...headTeacherSubjects.value],
      subjectId || context.subjectId,
      ['subjectId', 'id'],
      ['subjectName', 'name']))
    parts.push(optionName(examTypes.value, context.examTypeId, ['id'], ['examTypeName', 'name']))
  }
  return parts.join(' / ')
}

const teacherContextSummary = computed(() => contextSummary(teacherQuery))
const headTeacherContextSummary = computed(() => contextSummary({
  ...headTeacherQuery,
  subjectId: headTeacherGradeSubjectId.value
}))

function currentMode(): 'teacher' | 'headTeacher' {
  return teacherMode.value ? 'teacher' : 'headTeacher'
}

// ---- Helpers ----
const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.records || data.list || data.items || data.content || []
}
const totalOf = (value: any) => Number(payload(value).total ?? rows(value).length ?? 0)
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}

function trimText(text: string | undefined | null) {
  return (text || '').trim() || '-'
}

function formatScoreRange(row: AnyRow) {
  const min = row.minScore != null ? row.minScore : 0
  const max = row.maxScore != null ? row.maxScore : 100
  return `${min} - ${max}`
}

// ---- Subject Teacher Workbench State ----
const teacherScoreRows = ref<AnyRow[]>([])
const teacherSubjects = ref<AnyRow[]>([])
const teacherTotal = ref(0)
const teacherQuery = reactive({ academicTermId: '', gradeSession: '', gradeLevel: '', classId: '', subjectId: '', examTypeId: '' })
const teacherKeyword = ref('')
const teacherPage = reactive({ current: 1, size: 20, jump: 1 })
let teacherKeywordTimer: ReturnType<typeof setTimeout> | null = null

const teacherPageCount = computed(() => Math.max(1, Math.ceil(teacherTotal.value / teacherPage.size)))
const teacherPageNumbers = computed(() => {
  const count = teacherPageCount.value
  const start = Math.max(1, Math.min(teacherPage.current - 3, count - 6))
  const end = Math.min(count, start + 6)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

function teacherRowKey(row: AnyRow) {
  return `${row.classSubjectId || ''}_${row.studentId || ''}_${row.examTypeId || ''}_${row.id || 'new'}`
}

function onTeacherKeywordInput() {
  if (teacherKeywordTimer) clearTimeout(teacherKeywordTimer)
  teacherKeywordTimer = setTimeout(() => searchTeacherEntries(), 400)
}

async function searchTeacherEntries() {
  globalError.value = ''
  teacherPage.current = 1
  teacherPage.jump = 1
  await loadTeacherEntries()
}

async function loadTeacherEntries() {
  const params: AnyRow = {
    page: teacherPage.current,
    size: teacherPage.size,
    academicTermId: teacherQuery.academicTermId || undefined,
    classId: teacherQuery.classId || undefined,
    subjectId: teacherQuery.subjectId || undefined,
    examTypeId: teacherQuery.examTypeId || undefined,
    keyword: teacherKeyword.value || undefined
  }
  if (auth.isDualRoleTeacher) {
    params.mode = workspaceTab.value
  }
  const res = await call('listTeacherScoreEntries', params)
  teacherTotal.value = totalOf(res)
  const pageCount = Math.max(1, Math.ceil(teacherTotal.value / teacherPage.size))
  if (teacherPage.current > pageCount) {
    teacherPage.current = pageCount
    teacherPage.jump = pageCount
    await loadTeacherEntries()
    return
  }
  const selectedExam = examTypes.value.find(
    (item) => String(item.id) === String(teacherQuery.examTypeId))
  teacherScoreRows.value = (rows(res) as AnyRow[]).map((row: AnyRow) => ({
    ...row,
    examTypeId: row.examTypeId ?? teacherQuery.examTypeId,
    examTypeName: row.examTypeName
      || selectedExam?.examTypeName || selectedExam?.name || '',
    hasScore: row.score != null && row.score !== ''
  }))
}

function clearTeacherResults() {
  teacherPage.current = 1
  teacherPage.jump = 1
  teacherScoreRows.value = []
  teacherTotal.value = 0
}

function goTeacherPage(num: number) {
  teacherPage.current = Math.max(1, Math.min(num, teacherPageCount.value))
  teacherPage.jump = teacherPage.current
  loadTeacherEntries()
}

function jumpTeacherPage() {
  goTeacherPage(Number(teacherPage.jump) || 1)
}

async function onTeacherTermChange() {
  clearTeacherResults()
  teacherQuery.subjectId = ''
  teacherSubjects.value = []
  if (teacherQuery.classId) await loadTeacherSubjects()
}

async function onTeacherSessionChange() {
  clearTeacherResults()
  teacherQuery.gradeLevel = ''
  teacherQuery.classId = ''
  teacherQuery.subjectId = ''
  teacherSubjects.value = []
  persistLastSession('teacher', teacherQuery.gradeSession)
  await loadScopedClasses(teacherQuery)
}

async function onTeacherGradeChange() {
  clearTeacherResults()
  teacherQuery.classId = ''
  teacherQuery.subjectId = ''
  teacherSubjects.value = []
  await loadScopedClasses(teacherQuery)
}

async function onTeacherClassChange() {
  clearTeacherResults()
  teacherQuery.subjectId = ''
  await loadTeacherSubjects()
}

async function loadTeacherSubjects() {
  teacherSubjects.value = await loadClassSubjectsFor(
    teacherQuery.academicTermId, teacherQuery.classId, 'teacher')
}

async function resetTeacherQuery() {
  teacherQuery.academicTermId = defaultTermId()
  teacherQuery.gradeSession = defaultGradeSession('teacher')
  teacherQuery.gradeLevel = ''
  teacherQuery.classId = ''
  teacherQuery.subjectId = ''
  teacherQuery.examTypeId = ''
  teacherKeyword.value = ''
  teacherPage.current = 1
  teacherScoreRows.value = []
  teacherTotal.value = 0
  teacherSubjects.value = []
  teacherContextError.value = ''
  await loadScopedClasses(teacherQuery)
}

// ---- Head Teacher Workbench State ----
const headTeacherScoreRows = ref<AnyRow[]>([])
const overallComments = ref<AnyRow[]>([])
const achievements = ref<AnyRow[]>([])
const headTeacherTranscript = ref<AnyRow | null>(null)
const downloadingTranscript = ref(false)
const downloadVisible = ref(false)
const downloadPercent = ref(0)
const downloadAbortController = ref<AbortController | null>(null)
const headTeacherQuery = reactive({ academicTermId: '', gradeSession: '', gradeLevel: '', classId: '', examTypeId: '', studentId: '' })
const headTeacherGradeSubjectId = ref('')
const headTeacherSubjects = ref<AnyRow[]>([])
const studentKeyword = ref('')
const studentSuggestions = ref<AnyRow[]>([])
const allStudents = ref<AnyRow[]>([])
let studentKeywordTimer: ReturnType<typeof setTimeout> | null = null

const selectedStudent = computed(() => {
  if (!headTeacherQuery.studentId) return null
  return allStudents.value.find((s) => String(s.id) === String(headTeacherQuery.studentId)) || null
})

const workflowContext = computed(() => {
  const activeQuery = teacherMode.value ? teacherQuery : headTeacherQuery
  return {
    academicTermId: activeQuery.academicTermId,
    gradeSession: activeQuery.gradeSession,
    gradeLevel: activeQuery.gradeLevel,
    classId: activeQuery.classId,
    studentId: teacherMode.value ? '' : headTeacherQuery.studentId,
    examTypeId: activeQuery.examTypeId
  }
})

const workflowContextText = computed(() => {
  const activeQuery = teacherMode.value ? teacherQuery : headTeacherQuery
  const parts = [
    optionName(terms.value, activeQuery.academicTermId, ['id'], ['termName', 'name']),
    activeQuery.gradeSession ? `${activeQuery.gradeSession}届` : '',
    optionName(classes.value, activeQuery.classId, ['id'], ['className', 'name']),
    !teacherMode.value && selectedStudent.value
      ? String(selectedStudent.value.studentName || selectedStudent.value.name || '')
      : ''
  ].filter((item) => item && item !== '未选择')
  return parts.length ? parts.join(' / ') : '尚未选择教务范围'
})

function goTranscripts() {
  router.push({ path: '/transcripts', query: workflowContext.value })
}

const currentTermName = computed(() => {
  const term = terms.value.find((t) => String(t.id) === String(headTeacherQuery.academicTermId))
  return term?.termName || term?.name || '-'
})

const headTeacherTotalScore = computed(() => {
  return headTeacherScoreRows.value.reduce((sum, row) => sum + (Number(row.score) || 0), 0)
})

function headTeacherRowKey(row: AnyRow) {
  return `${row.subjectId || ''}_${row.examTypeId || ''}_${row.id || 'new'}`
}

function searchStudents() {
  headTeacherQuery.studentId = ''
  if (!headTeacherQuery.classId || !studentKeyword.value) {
    studentSuggestions.value = []
    return
  }
  if (studentKeywordTimer) clearTimeout(studentKeywordTimer)
  studentKeywordTimer = setTimeout(() => performStudentSearch(), 350)
}

async function performStudentSearch() {
  const params: AnyRow = { keyword: studentKeyword.value, page: 1, size: 8 }
  if (headTeacherQuery.classId) params.classId = Number(headTeacherQuery.classId)
  try {
    const res = await call('listStudents', params)
    studentSuggestions.value = rows(res)
  } catch {
    studentSuggestions.value = []
  }
}

function selectFirstStudent() {
  if (studentSuggestions.value.length > 0) {
    selectStudent(studentSuggestions.value[0])
  }
}

function selectStudent(student: AnyRow) {
  headTeacherQuery.studentId = String(student.id)
  studentKeyword.value = student.studentName || student.name || ''
  studentSuggestions.value = []
  searchHeadTeacherScores()
}

async function onHeadTeacherTermChange() {
  headTeacherQuery.studentId = ''
  headTeacherGradeSubjectId.value = ''
  headTeacherSubjects.value = []
  studentKeyword.value = ''
  clearHeadTeacherDetails()
  if (headTeacherQuery.classId) await loadHeadTeacherSubjects()
}

async function onHeadTeacherSessionChange() {
  headTeacherQuery.gradeLevel = ''
  headTeacherQuery.classId = ''
  headTeacherQuery.studentId = ''
  headTeacherGradeSubjectId.value = ''
  headTeacherSubjects.value = []
  allStudents.value = []
  studentKeyword.value = ''
  clearHeadTeacherDetails()
  persistLastSession('headTeacher', headTeacherQuery.gradeSession)
  await loadScopedClasses(headTeacherQuery)
}

async function onHeadTeacherGradeChange() {
  headTeacherQuery.classId = ''
  headTeacherQuery.studentId = ''
  headTeacherGradeSubjectId.value = ''
  headTeacherSubjects.value = []
  allStudents.value = []
  studentKeyword.value = ''
  clearHeadTeacherDetails()
  await loadScopedClasses(headTeacherQuery)
}

async function onHeadTeacherClassChange() {
  headTeacherQuery.studentId = ''
  studentKeyword.value = ''
  if (headTeacherQuery.classId) {
    try {
      const [studentRes] = await Promise.all([
        call('listStudents', { classId: Number(headTeacherQuery.classId), page: 1, size: 500 }),
        loadHeadTeacherSubjects()
      ])
      allStudents.value = rows(studentRes)
    } catch {
      allStudents.value = []
      headTeacherSubjects.value = []
    }
  } else {
    allStudents.value = []
    headTeacherSubjects.value = []
  }
  headTeacherGradeSubjectId.value = ''
  clearHeadTeacherDetails()
}

async function loadHeadTeacherSubjects() {
  headTeacherSubjects.value = await loadClassSubjectsFor(
    headTeacherQuery.academicTermId, headTeacherQuery.classId, 'headTeacher')
}

function clearHeadTeacherDetails() {
  headTeacherScoreRows.value = []
  overallComments.value = []
  achievements.value = []
  headTeacherTranscript.value = null
}

async function searchHeadTeacherScores() {
  globalError.value = ''
  if (!headTeacherQuery.studentId) {
    headTeacherScoreRows.value = []
    overallComments.value = []
    achievements.value = []
    headTeacherTranscript.value = null
    return
  }
  await Promise.all([
    loadHeadTeacherScores(),
    loadOverallComments(),
    loadAchievements(),
    loadHeadTeacherTranscript()
  ])
}

async function loadHeadTeacherScores() {
  const params: AnyRow = {
    academicTermId: headTeacherQuery.academicTermId || undefined,
    examTypeId: headTeacherQuery.examTypeId || undefined,
    studentId: Number(headTeacherQuery.studentId)
  }
  try {
    const res = await call('listStudentResults', params)
    headTeacherScoreRows.value = rows(res)
  } catch {
    headTeacherScoreRows.value = []
  }
}

async function loadOverallComments() {
  const params: AnyRow = {
    academicTermId: headTeacherQuery.academicTermId || undefined,
    studentId: Number(headTeacherQuery.studentId)
  }
  try {
    const res = await call('listOverallComments', params)
    overallComments.value = rows(res)
  } catch {
    overallComments.value = []
  }
}

async function loadAchievements() {
  if (!headTeacherQuery.studentId) {
    achievements.value = []
    return
  }
  const termId = headTeacherQuery.academicTermId || defaultTermId()
  if (!termId) {
    achievements.value = []
    return
  }
  try {
    const res = await call('listStudentAchievements', Number(headTeacherQuery.studentId), Number(termId))
    achievements.value = rows(res)
  } catch {
    achievements.value = []
  }
}

async function loadHeadTeacherTranscript() {
  const params: AnyRow = {
    academicTermId: (headTeacherQuery.academicTermId || defaultTermId()) || undefined,
    studentId: Number(headTeacherQuery.studentId),
    page: 1, size: 1
  }
  try {
    const res = await call('listTranscripts', params)
    const list = rows(res)
    headTeacherTranscript.value = list.length > 0 ? list[0] : null
  } catch {
    headTeacherTranscript.value = null
  }
}

async function resetHeadTeacherQuery() {
  headTeacherQuery.academicTermId = defaultTermId()
  headTeacherQuery.gradeSession = defaultGradeSession('headTeacher')
  headTeacherQuery.gradeLevel = ''
  headTeacherQuery.classId = ''
  headTeacherQuery.examTypeId = ''
  headTeacherQuery.studentId = ''
  studentKeyword.value = ''
  studentSuggestions.value = []
  headTeacherScoreRows.value = []
  overallComments.value = []
  achievements.value = []
  headTeacherTranscript.value = null
  headTeacherGradeSubjectId.value = ''
  headTeacherSubjects.value = []
  headTeacherContextError.value = ''
  await loadScopedClasses(headTeacherQuery)
}

async function downloadHeadTeacherTranscript() {
  if (downloadingTranscript.value) return
  if (!headTeacherQuery.academicTermId && !defaultTermId()) {
    errorStore.show('请先选择学期')
    return
  }
  if (!headTeacherQuery.classId) {
    errorStore.show('请先选择班级')
    return
  }
  if (!headTeacherQuery.studentId) {
    errorStore.show('请先选择学生')
    return
  }
  downloadingTranscript.value = true
  downloadVisible.value = true
  downloadPercent.value = 0
  const controller = new AbortController()
  downloadAbortController.value = controller
  try {
    // 1. 生成成绩单
    const transcript = await call('createTranscript', {
      academicTermId: Number(headTeacherQuery.academicTermId || defaultTermId()),
      classId: Number(headTeacherQuery.classId),
      studentId: Number(headTeacherQuery.studentId),
      generatedByUserId: auth.user?.id ?? null
    })
    // 2. 下载成绩单（带进度条）
    const res = await call('downloadTranscript', transcript.id, {
      signal: controller.signal,
      onProgress: (percent: number) => {
        downloadPercent.value = percent
      }
    })
    const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data ?? res], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = transcript.pdfFileName || `${selectedStudent.value?.studentName || '成绩单'}.pdf`
    link.click()
    URL.revokeObjectURL(url)
    // 刷新成绩单状态
    await loadHeadTeacherTranscript()
  } catch (err: any) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      // 错误已由全局弹窗展示
    }
  } finally {
    downloadingTranscript.value = false
    downloadVisible.value = false
    downloadAbortController.value = null
  }
}

function cancelHeadTeacherDownload() {
  downloadAbortController.value?.abort()
}

// ---- Score Modal State ----
const scoreModalVisible = ref(false)
const scoreModalError = ref('')
// 班级已配置的课程列表（用于成绩录入弹窗的下拉选项）
const classSubjectOptions = ref<AnyRow[]>([])
const scoreForm = reactive<AnyRow>({
  id: '', studentId: '', studentName: '', className: '', classId: '',
  subjectId: '', examTypeId: '', score: 0, minScore: 0, maxScore: 100,
  performanceComment: '', strengths: '', improvementPoints: '',
  academicTermId: '', classSubjectId: '', isEdit: false
})

const scoreFormTitle = computed(() => {
  const subject = classSubjectOptions.value.find((s) => String(s.subjectId || s.id) === String(scoreForm.subjectId))
  const name = subject?.subjectName || subject?.name || '未选择'
  return `${scoreForm.studentName || '学生'} - ${name}`
})

function defaultTermId() {
  const defaultTerm = terms.value.find((t: AnyRow) => Number(t.status) === 1) || terms.value[0]
  return defaultTerm ? String(defaultTerm.id) : ''
}

async function loadClassSubjectOptions(classId: string, academicTermId: string) {
  if (!classId || !academicTermId) {
    classSubjectOptions.value = []
    return
  }
  try {
    const res = await call('listClassSubjects', Number(academicTermId), Number(classId))
    classSubjectOptions.value = rows(res)
  } catch {
    classSubjectOptions.value = []
  }
}

async function openScoreModal(row: AnyRow | null) {
  scoreModalError.value = ''
  if (row) {
    scoreForm.id = row.id || ''
    scoreForm.studentId = String(row.studentId || headTeacherQuery.studentId || '')
    scoreForm.studentName = row.studentName || selectedStudent.value?.studentName || selectedStudent.value?.name || ''
    scoreForm.className = row.className || selectedStudent.value?.className || ''
    scoreForm.subjectId = String(row.subjectId || '')
    scoreForm.examTypeId = String(row.examTypeId || teacherQuery.examTypeId || headTeacherQuery.examTypeId || '')
    scoreForm.score = Number(row.score || 0)
    scoreForm.minScore = Number(row.minScore ?? 0)
    scoreForm.maxScore = Number(row.maxScore ?? 100)
    scoreForm.performanceComment = row.performanceComment || ''
    scoreForm.strengths = row.strengths || ''
    scoreForm.improvementPoints = row.improvementPoints || ''
    scoreForm.academicTermId = row.academicTermId || headTeacherQuery.academicTermId || teacherQuery.academicTermId || defaultTermId()
    scoreForm.classSubjectId = row.classSubjectId || ''
    scoreForm.classId = row.classId || headTeacherQuery.classId || teacherQuery.classId || ''
    scoreForm.isEdit = true
  } else {
    scoreForm.id = ''
    scoreForm.studentId = String(headTeacherQuery.studentId || '')
    scoreForm.studentName = selectedStudent.value?.studentName || selectedStudent.value?.name || ''
    scoreForm.className = selectedStudent.value?.className || ''
    scoreForm.subjectId = ''
    scoreForm.examTypeId = headTeacherQuery.examTypeId || ''
    scoreForm.score = 0
    scoreForm.minScore = 0
    scoreForm.maxScore = 100
    scoreForm.performanceComment = ''
    scoreForm.strengths = ''
    scoreForm.improvementPoints = ''
    scoreForm.academicTermId = headTeacherQuery.academicTermId || defaultTermId()
    scoreForm.classSubjectId = ''
    scoreForm.classId = headTeacherQuery.classId || ''
    scoreForm.isEdit = false
  }
  // 加载科目下拉选项：任课老师用已任教科目列表，班主任/管理员从 API 加载班级全部课程
  if (teacherMode.value && teacherSubjects.value.length > 0) {
    classSubjectOptions.value = teacherSubjects.value.map(s => ({ ...s }))
  } else if (teacherMode.value) {
    classSubjectOptions.value = []
  } else {
    const classId = scoreForm.classId || headTeacherQuery.classId
    const termId = scoreForm.academicTermId || headTeacherQuery.academicTermId
    if (classId && termId) {
      await loadClassSubjectOptions(classId, termId)
    }
  }

  scoreModalVisible.value = true
}

function closeScoreModal() {
  scoreModalVisible.value = false
  scoreModalError.value = ''
}

function onScoreSubjectChange() {
  const selected = classSubjectOptions.value.find(
    (item) => String(item.subjectId || item.id) === String(scoreForm.subjectId))
  scoreForm.classSubjectId = selected?.id || ''
  scoreForm.minScore = Number(selected?.minScore ?? 0)
  scoreForm.maxScore = Number(selected?.maxScore ?? 100)
}

async function submitScore() {
  scoreModalError.value = ''
  if (scoreForm.score == null || scoreForm.score === '') {
    scoreModalError.value = '请填写成绩'
    return
  }
  if (!scoreForm.studentId) {
    scoreModalError.value = '请选择学生'
    return
  }
  if (!scoreForm.subjectId) {
    scoreModalError.value = '请选择科目'
    return
  }
  const body: AnyRow = {
    studentId: Number(scoreForm.studentId),
    score: Number(scoreForm.score),
    academicTermId: scoreForm.academicTermId ? Number(scoreForm.academicTermId) : undefined,
    classSubjectId: scoreForm.classSubjectId || undefined,
    classId: scoreForm.classId ? Number(scoreForm.classId) : undefined,
    subjectId: scoreForm.subjectId ? Number(scoreForm.subjectId) : undefined,
    examTypeId: scoreForm.examTypeId || undefined,
    performanceComment: scoreForm.performanceComment || undefined,
    strengths: scoreForm.strengths || undefined,
    improvementPoints: scoreForm.improvementPoints || undefined
  }
  if (scoreForm.id) body.id = Number(scoreForm.id)
  try {
    await call('saveStudentResult', body)
    closeScoreModal()
    if (teacherMode.value) await loadTeacherEntries()
    else await searchHeadTeacherScores()
  } catch (e: any) {
    // 错误已由全局弹窗展示
  }
}

async function deleteScore(row: AnyRow) {
  if (!row.id) return
  if (!window.confirm('确定删除该学生的这条成绩记录吗？此操作不可恢复。')) return
  try {
    await call('deleteStudentResult', row.id)
    if (teacherMode.value) await loadTeacherEntries()
    else await searchHeadTeacherScores()
  } catch (e: any) {
    // 错误已由全局弹窗展示
  }
}

// ---- Overall Comment Modal State ----
const overallCommentModalVisible = ref(false)
const overallCommentModalError = ref('')
const overallCommentForm = reactive({ overallComment: '', strengths: '', improvementPoints: '' })

function openOverallCommentModal() {
  overallCommentModalError.value = ''
  if (overallComments.value.length > 0) {
    const existing = overallComments.value[0]
    overallCommentForm.overallComment = existing.overallComment || ''
    overallCommentForm.strengths = existing.strengths || ''
    overallCommentForm.improvementPoints = existing.improvementPoints || ''
  } else {
    overallCommentForm.overallComment = ''
    overallCommentForm.strengths = ''
    overallCommentForm.improvementPoints = ''
  }
  overallCommentModalVisible.value = true
}

function closeOverallCommentModal() {
  overallCommentModalVisible.value = false
  overallCommentModalError.value = ''
}

async function submitOverallComment() {
  overallCommentModalError.value = ''
  if (!headTeacherQuery.studentId) {
    overallCommentModalError.value = '请先选择学生'
    return
  }
  const body: AnyRow = {
    academicTermId: (headTeacherQuery.academicTermId || defaultTermId()) ? Number(headTeacherQuery.academicTermId || defaultTermId()) : undefined,
    classId: headTeacherQuery.classId ? Number(headTeacherQuery.classId) : undefined,
    studentId: Number(headTeacherQuery.studentId),
    overallComment: overallCommentForm.overallComment || undefined,
    strengths: overallCommentForm.strengths || undefined,
    improvementPoints: overallCommentForm.improvementPoints || undefined
  }
  if (overallComments.value.length > 0) body.id = Number(overallComments.value[0].id)
  try {
    await call('saveOverallComment', body)
    closeOverallCommentModal()
    await loadOverallComments()
  } catch (e: any) {
    // 错误已由全局弹窗展示
  }
}

// ---- Achievement Modal State ----
const achievementModalVisible = ref(false)
const achievementModalError = ref('')
const achievementSaving = ref(false)
const editingAchievement = ref<AnyRow | null>(null)
const achievementForm = reactive({ honorTypeId: '', achievementText: '' })

function openAchievementModal(item: AnyRow | null) {
  achievementModalError.value = ''
  editingAchievement.value = item
  if (item) {
    achievementForm.honorTypeId = item.honorTypeId ? String(item.honorTypeId) : ''
    achievementForm.achievementText = item.achievementText || ''
  } else {
    achievementForm.honorTypeId = ''
    achievementForm.achievementText = ''
  }
  achievementModalVisible.value = true
}

function closeAchievementModal() {
  achievementModalVisible.value = false
  achievementModalError.value = ''
}

async function submitAchievement() {
  achievementModalError.value = ''
  achievementSaving.value = true
  try {
    if (editingAchievement.value) {
      await call('updateAchievement', editingAchievement.value.id, {
        honorTypeId: achievementForm.honorTypeId ? Number(achievementForm.honorTypeId) : undefined,
        achievementText: achievementForm.achievementText || undefined
      })
    } else {
      await call('createStudentAchievement', Number(headTeacherQuery.studentId), {
        academicTermId: (headTeacherQuery.academicTermId || defaultTermId()) ? Number(headTeacherQuery.academicTermId || defaultTermId()) : undefined,
        honorTypeId: achievementForm.honorTypeId ? Number(achievementForm.honorTypeId) : undefined,
        achievementText: achievementForm.achievementText || undefined
      })
    }
    closeAchievementModal()
    await loadAchievements()
  } catch (e: any) {
    globalError.value = e?.message || '加载失败'
  } finally {
    achievementSaving.value = false
  }
}

async function removeAchievement(id: string | number) {
  if (!window.confirm('确定删除这条荣誉记录吗？')) return
  try {
    await call('deleteAchievement', id)
    await loadAchievements()
  } catch (e: any) {
    // 错误已由全局弹窗展示
  }
}

// ---- Polish Functionality ----
const polishingField = ref('')

async function doPolish(field: string, text: string, target: AnyRow, key: string) {
  if (!text || polishingField.value) return
  polishingField.value = field
  try {
    const res = await schoolApi.polishComment(text)
    const polished = (res as AnyRow)?.polishedText || (res as AnyRow)?.data?.polishedText || (res as AnyRow)?.data || text
    target[key] = polished
  } catch {
    // Keep original text on polish failure
  } finally {
    polishingField.value = ''
  }
}

// ---- Comment Tooltip ----
const tooltip = reactive({ visible: false, text: '', x: 0, y: 0 })

function showTooltip(event: MouseEvent, text: string | undefined | null) {
  const trimmed = trimText(text)
  if (trimmed === '-') return
  tooltip.visible = true
  tooltip.text = trimmed
  tooltip.x = event.clientX
  tooltip.y = event.clientY
}

function moveTooltip(event: MouseEvent) {
  if (tooltip.visible) {
    tooltip.x = event.clientX
    tooltip.y = event.clientY
  }
}

function hideTooltip() {
  tooltip.visible = false
  tooltip.text = ''
}

// ---- Excel Import/Export ----
const importDialogVisible = ref(false)
const importDialogTitle = ref('')
const importEnableAiPolish = ref(false)
const importLoading = ref(false)
const importResult = ref<any>(null)
const importError = ref('')
const importSelectedFile = ref<File | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const importScene = ref<'course' | 'parent'>('course')
const importSourceMode = ref<'teacher' | 'headTeacher'>('teacher')
const importStep = ref(1)
const importToken = ref('')
const importCommitted = ref(false)
const importClasses = ref<AnyRow[]>([])
const importSubjects = ref<AnyRow[]>([])
const importFieldErrors = reactive<AnyRow>({})
const importContext = reactive({
  academicTermId: '', gradeSession: '', gradeLevel: '', classId: '', subjectId: '', examTypeId: ''
})
const isCourseImport = computed(() => importScene.value === 'course')

function showTeacherImportDialog() {
  openImportDialog('course', 'teacher', teacherQuery, '导入单科成绩')
}

function showHeadTeacherScoreImportDialog() {
  openImportDialog('course', 'headTeacher', {
    ...headTeacherQuery,
    subjectId: headTeacherGradeSubjectId.value
  }, '导入单科成绩')
}

function showHeadTeacherImportDialog() {
  openImportDialog('parent', 'headTeacher', headTeacherQuery, '导入评语与荣誉')
}

async function openImportDialog(
  scene: 'course' | 'parent',
  sourceMode: 'teacher' | 'headTeacher',
  source: AnyRow,
  title: string
) {
  importScene.value = scene
  importSourceMode.value = sourceMode
  importDialogTitle.value = title
  importContext.academicTermId = source.academicTermId || defaultTermId()
  importContext.gradeSession = source.gradeSession || defaultGradeSession(sourceMode)
  importContext.gradeLevel = source.gradeLevel || ''
  importContext.classId = source.classId || ''
  importContext.subjectId = source.subjectId || ''
  importContext.examTypeId = source.examTypeId || ''
  importEnableAiPolish.value = false
  importSelectedFile.value = null
  clearImportState()
  importDialogVisible.value = true
  await loadImportClasses()
  if (importContext.classId) await loadImportSubjects()
}

function clearImportState() {
  importResult.value = null
  importError.value = ''
  importLoading.value = false
  importToken.value = ''
  importStep.value = 1
  importCommitted.value = false
  Object.keys(importFieldErrors).forEach((key) => delete importFieldErrors[key])
}

function closeImportDialog() {
  importDialogVisible.value = false
  importSelectedFile.value = null
  importClasses.value = []
  importSubjects.value = []
  if (importFileInput.value) importFileInput.value.value = ''
  clearImportState()
}

function onImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    importSelectedFile.value = file
    invalidateImportPrecheck()
  }
}

function invalidateImportPrecheck() {
  importError.value = ''
  importResult.value = null
  importToken.value = ''
  importStep.value = 1
  importCommitted.value = false
}

async function onImportTermChange() {
  importContext.subjectId = ''
  importSubjects.value = []
  invalidateImportPrecheck()
  if (importContext.classId) await loadImportSubjects()
}

async function onImportSessionChange() {
  importContext.gradeLevel = ''
  importContext.classId = ''
  importContext.subjectId = ''
  importSubjects.value = []
  invalidateImportPrecheck()
  await loadImportClasses()
}

async function onImportGradeChange() {
  importContext.classId = ''
  importContext.subjectId = ''
  importSubjects.value = []
  invalidateImportPrecheck()
  await loadImportClasses()
}

async function onImportClassChange() {
  importContext.subjectId = ''
  invalidateImportPrecheck()
  await loadImportSubjects()
}

async function loadImportClasses() {
  const params: AnyRow = { page: 1, size: 500, mode: importSourceMode.value }
  if (importContext.gradeSession) params.gradeSession = importContext.gradeSession
  if (importContext.gradeLevel) params.gradeLevel = Number(importContext.gradeLevel)
  const response = await call('listClasses', params)
  importClasses.value = rows(response).filter((item) => Number(item.status) === 1)
  if (importContext.classId && !importClasses.value.some((item) => String(item.id) === importContext.classId)) {
    importContext.classId = ''
    importContext.subjectId = ''
  }
}

async function loadImportSubjects() {
  importSubjects.value = await loadClassSubjectsFor(
    importContext.academicTermId, importContext.classId, importSourceMode.value)
  if (importContext.subjectId && !importSubjects.value.some(
    (item) => String(item.subjectId || item.id) === importContext.subjectId)) {
    importContext.subjectId = ''
  }
}

function validateImportContext() {
  Object.keys(importFieldErrors).forEach((key) => delete importFieldErrors[key])
  const required: Array<[string, string, string]> = [
    ['academicTermId', '请选择学期', 'import-term'],
    ['gradeSession', '请选择届次', 'import-session'],
    ['gradeLevel', '请选择年级', 'import-grade'],
    ['classId', '请选择班级', 'import-class']
  ]
  if (isCourseImport.value) {
    required.push(['subjectId', '请选择科目', 'import-subject'], ['examTypeId', '请选择考试类型', 'import-exam'])
  }
  required.push(['file', '请选择 Excel 文件', ''])
  for (const [field, message, elementId] of required) {
    const value = field === 'file' ? importSelectedFile.value : (importContext as AnyRow)[field]
    if (!value) importFieldErrors[field] = message
    if (!value && elementId) {
      setTimeout(() => document.getElementById(elementId)?.focus(), 0)
      return false
    }
  }
  return Object.keys(importFieldErrors).length === 0
}

async function precheckImport() {
  if (!validateImportContext()) return
  const file = importSelectedFile.value as File
  importLoading.value = true
  importError.value = ''
  importResult.value = null
  importToken.value = ''
  importStep.value = 2
  try {
    const commonContext = {
      academicTermId: Number(importContext.academicTermId),
      gradeSession: importContext.gradeSession,
      gradeLevel: Number(importContext.gradeLevel),
      classId: Number(importContext.classId)
    }
    if (isCourseImport.value) {
      importResult.value = await schoolApi.precheckCourseResults(file, {
        ...commonContext,
        subjectId: Number(importContext.subjectId),
        examTypeId: Number(importContext.examTypeId)
      })
    } else {
      importResult.value = await schoolApi.precheckHeadTeacherData(file, commonContext, importEnableAiPolish.value)
    }
    importToken.value = importResult.value?.importToken || ''
  } catch (e: any) {
    importError.value = e?.message || '预校验失败，请检查文件格式和页面上下文'
  } finally {
    importLoading.value = false
  }
}

async function commitImport() {
  if (!importToken.value || Number(importResult.value?.errorCount || 0) > 0) return
  importLoading.value = true
  importError.value = ''
  importStep.value = 3
  try {
    importResult.value = isCourseImport.value
      ? await schoolApi.commitCourseResults(importToken.value)
      : await schoolApi.commitHeadTeacherData(importToken.value)
    importToken.value = ''
    importCommitted.value = true
    if (importScene.value === 'course' && importSourceMode.value === 'teacher') {
      await loadTeacherEntries()
    } else if (importScene.value === 'course' && headTeacherQuery.studentId) {
      await loadHeadTeacherScores()
    } else if (headTeacherQuery.studentId) {
      await Promise.all([loadOverallComments(), loadAchievements()])
    }
  } catch (e: any) {
    importToken.value = ''
    importStep.value = 2
    importError.value = e?.message || '导入失败，请重新预校验后再试'
  } finally {
    importLoading.value = false
  }
}

function downloadImportErrors() {
  const errors = importResult.value?.errors || []
  if (!errors.length) return
  const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [['行号', '学号', '姓名', '原因'], ...errors.map((item: AnyRow) => [
    item.row || '', item.studentNo || '', item.studentName || '', item.reason || ''
  ])]
  const blob = new Blob(['\ufeff' + lines.map((line) => line.map(escapeCsv).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `导入错误清单_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function exportTeacherTemplate() {
  if (!validateExportContext(teacherQuery, true, 'teacher')) return
  exportLoading.value = 'teacher'
  try {
    const res: any = await schoolApi.exportCourseResultTemplate({
      academicTermId: Number(teacherQuery.academicTermId),
      gradeSession: teacherQuery.gradeSession,
      gradeLevel: Number(teacherQuery.gradeLevel),
      classId: Number(teacherQuery.classId),
      subjectId: Number(teacherQuery.subjectId),
      examTypeId: Number(teacherQuery.examTypeId)
    })
    saveBlobFile(res, `成绩模版_${getClassNameById(teacherQuery.classId)}_${getSubjectNameById(teacherQuery.subjectId)}.xlsx`)
  } catch (e: any) {
    if (e?.message) errorStore.show(e.message)
  } finally {
    exportLoading.value = ''
  }
}

async function exportHeadTeacherTemplate() {
  if (!validateExportContext(headTeacherQuery, false, 'head')) return
  exportLoading.value = 'parent'
  try {
    const res: any = await schoolApi.exportHeadTeacherTemplate({
      academicTermId: Number(headTeacherQuery.academicTermId),
      gradeSession: headTeacherQuery.gradeSession,
      gradeLevel: Number(headTeacherQuery.gradeLevel),
      classId: Number(headTeacherQuery.classId)
    })
    saveBlobFile(res, `综合评价与荣誉_${getClassNameById(headTeacherQuery.classId)}.xlsx`)
  } catch (e: any) {
    if (e?.message) errorStore.show(e.message)
  } finally {
    exportLoading.value = ''
  }
}

async function exportHeadTeacherGradeTemplate() {
  const context = { ...headTeacherQuery, subjectId: headTeacherGradeSubjectId.value }
  if (!validateExportContext(context, true, 'head')) return
  exportLoading.value = 'headScore'
  try {
    const res: any = await schoolApi.exportCourseResultTemplate({
      academicTermId: Number(headTeacherQuery.academicTermId),
      gradeSession: headTeacherQuery.gradeSession,
      gradeLevel: Number(headTeacherQuery.gradeLevel),
      classId: Number(headTeacherQuery.classId),
      subjectId: Number(headTeacherGradeSubjectId.value),
      examTypeId: Number(headTeacherQuery.examTypeId)
    })
    saveBlobFile(res, `成绩模版_${getClassNameById(headTeacherQuery.classId)}_${getSubjectNameById(headTeacherGradeSubjectId.value)}.xlsx`)
  } catch (e: any) {
    if (e?.message) errorStore.show(e.message)
  } finally {
    exportLoading.value = ''
  }
}

function validateExportContext(context: AnyRow, includeCourse: boolean, prefix: 'teacher' | 'head') {
  const fields: Array<[string, string, string]> = [
    ['academicTermId', '请选择学期', `${prefix}-term`],
    ['gradeSession', '请选择届次', `${prefix}-session`],
    ['gradeLevel', '请选择年级', `${prefix}-grade`],
    ['classId', '请选择班级', `${prefix}-class`]
  ]
  if (includeCourse) {
    fields.push(['subjectId', '请选择科目', `${prefix}-subject`], ['examTypeId', '请选择考试类型', `${prefix}-exam`])
  }
  const missing = fields.find(([field]) => !context[field])
  if (!missing) {
    if (prefix === 'teacher') teacherContextError.value = ''
    else headTeacherContextError.value = ''
    return true
  }
  if (prefix === 'teacher') teacherContextError.value = missing[1]
  else headTeacherContextError.value = missing[1]
  document.getElementById(missing[2])?.focus()
  return false
}

function saveBlobFile(res: any, defaultFileName: string) {
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data ?? res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  // Try to get filename from header
  const disposition = res?.headers?.['content-disposition']
  let fileName = defaultFileName
  if (disposition) {
    const match = disposition.match(/filename\*=UTF-8''(.+)/)
    if (match) fileName = decodeURIComponent(match[1])
    else {
      const simple = disposition.match(/filename="(.+)"/)
      if (simple) fileName = simple[1]
    }
  }
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function getClassNameById(classId: string) {
  const c = classes.value.find((x: AnyRow) => String(x.id) === classId)
  return c?.className || c?.name || classId
}

function getSubjectNameById(subjectId: string) {
  const options = [...teacherSubjects.value, ...headTeacherSubjects.value, ...subjects.value]
  const s = options.find((x: AnyRow) => String(x.subjectId || x.id) === subjectId)
  return s?.subjectName || s?.name || subjectId
}

// ---- Initialization ----
async function loadBaseData() {
  const mode = currentMode()
  const [termRes, filterRes, subjectRes, examRes, honorRes] = await Promise.all([
    call('listAcademicTerms'),
    call('listClassFilterOptions', { mode }),
    call('listSubjects', { mode }),
    call('listExamTypes'),
    call('listEnabledHonorTypes').catch(() => call('listHonorTypes'))
  ])
  terms.value = rows(termRes)
  classFilterOptions.value = payload(filterRes)
  subjects.value = rows(subjectRes)
  examTypes.value = rows(examRes)
  honorTypes.value = rows(honorRes)
}

async function loadScopedClasses(query: AnyRow) {
  const mode: 'teacher' | 'headTeacher' = query === teacherQuery ? 'teacher' : 'headTeacher'
  const params: AnyRow = { page: 1, size: 500, mode }
  if (query.gradeSession) params.gradeSession = query.gradeSession
  if (query.gradeLevel) params.gradeLevel = Number(query.gradeLevel)
  const response = await call('listClasses', params)
  classes.value = rows(response).filter((item) => Number(item.status) === 1)
  if (query.classId && !classes.value.some((item) => String(item.id) === String(query.classId))) {
    query.classId = ''
    query.subjectId = ''
  }
}

async function loadClassSubjectsFor(
  academicTermId: string,
  classId: string,
  mode: 'teacher' | 'headTeacher'
) {
  if (!academicTermId || !classId) return []
  try {
    const response = await schoolApi.listClassSubjects(
      Number(academicTermId), Number(classId), mode)
    return rows(response)
  } catch {
    return []
  }
}

function sessionStorageKey(mode: 'teacher' | 'headTeacher') {
  return `xinshi-scores-last-session-${mode}`
}

function persistLastSession(mode: 'teacher' | 'headTeacher', gradeSession: string) {
  if (gradeSession) localStorage.setItem(sessionStorageKey(mode), gradeSession)
  else localStorage.removeItem(sessionStorageKey(mode))
}

function defaultGradeSession(mode: 'teacher' | 'headTeacher') {
  const routeSession = mode === 'headTeacher' ? String(route.query.gradeSession || '') : ''
  if (routeSession && gradeSessions.value.includes(routeSession)) return routeSession
  const stored = localStorage.getItem(sessionStorageKey(mode)) || ''
  if (stored && gradeSessions.value.includes(stored)) return stored
  return gradeSessions.value.length === 1 ? gradeSessions.value[0] : ''
}

function initFromRoute() {
  const routeAcademicTermId = String(route.query.academicTermId || '')
  const routeGradeSession = String(route.query.gradeSession || '')
  const routeGradeLevel = String(route.query.gradeLevel || '')
  const routeClassId = String(route.query.classId || '')
  const routeStudentId = String(route.query.studentId || '')
  const routeExamTypeId = String(route.query.examTypeId || '')

  if (routeStudentId && auth.isHeadTeacher) {
    workspaceTab.value = 'headTeacher'
  }

  const targetQuery = teacherMode.value ? teacherQuery : headTeacherQuery
  if (routeAcademicTermId) targetQuery.academicTermId = routeAcademicTermId
  if (routeGradeSession) targetQuery.gradeSession = routeGradeSession
  if (routeGradeLevel) targetQuery.gradeLevel = routeGradeLevel
  if (routeClassId) targetQuery.classId = routeClassId
  if (routeExamTypeId) targetQuery.examTypeId = routeExamTypeId
  if (!teacherMode.value && routeStudentId) headTeacherQuery.studentId = routeStudentId
}

async function loadPage() {
  loading.value = true
  globalError.value = ''
  try {
    await loadBaseData()

    const defaultTerm = terms.value.find((t: AnyRow) => Number(t.status) === 1) || terms.value[0]
    if (defaultTerm && !headTeacherQuery.academicTermId) headTeacherQuery.academicTermId = String(defaultTerm.id)
    if (defaultTerm && !teacherQuery.academicTermId) {
      teacherQuery.academicTermId = String(defaultTerm.id)
    }

    const activeQuery = teacherMode.value ? teacherQuery : headTeacherQuery
    if (activeQuery.classId && (!activeQuery.gradeSession || !activeQuery.gradeLevel)) {
      const allClassResponse = await call('listClasses', { page: 1, size: 500, mode: currentMode() })
      const targetClass = rows(allClassResponse).find(
        (item) => Number(item.status) === 1 && String(item.id) === String(activeQuery.classId))
      if (targetClass) {
        activeQuery.gradeSession = targetClass.gradeSession || ''
        activeQuery.gradeLevel = targetClass.gradeLevel ? String(targetClass.gradeLevel) : ''
      }
    }
    if (!activeQuery.gradeSession) activeQuery.gradeSession = defaultGradeSession(currentMode())
    await loadScopedClasses(activeQuery)
    if (!activeQuery.classId && classes.value.length === 1) activeQuery.classId = String(classes.value[0].id)

    if (teacherMode.value) {
      if (teacherQuery.classId) await loadTeacherSubjects()
      await loadTeacherEntries()
    } else {
      const routeStudentId = headTeacherQuery.studentId

      if (headTeacherQuery.classId) {
        await onHeadTeacherClassChange()
      }

      if (routeStudentId) {
        headTeacherQuery.studentId = routeStudentId
      }
      if (headTeacherQuery.studentId && allStudents.value.length > 0 &&
          !allStudents.value.some((s) => String(s.id) === String(headTeacherQuery.studentId))) {
        headTeacherQuery.studentId = ''
        studentKeyword.value = ''
      }

      if (headTeacherQuery.studentId) {
        const student = allStudents.value.find((s) => String(s.id) === String(headTeacherQuery.studentId))
        if (student) studentKeyword.value = student.studentName || student.name || ''
      }

      await searchHeadTeacherScores()
    }
  } catch (e: any) {
    globalError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  initFromRoute()
  loadPage()
})

// Watch route query changes and re-initialize
watch(
  () => [route.query.classId, route.query.studentId, route.query.academicTermId, route.query.gradeSession, route.query.gradeLevel, route.query.examTypeId],
  () => {
    initFromRoute()
    loadPage()
  }
)
</script>

<style scoped>
.scores-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  gap: 20px;
}

.scores-page > * {
  min-width: 0;
}

.academic-page-header {
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding: 8px 2px 20px;
}

.academic-page-header h1 {
  color: #0f172a;
  font-size: clamp(28px, 3vw, 38px);
  letter-spacing: -.035em;
  line-height: 1.1;
  margin: 7px 0 0;
}

.academic-page-header .lead {
  font-size: 14px;
  line-height: 1.6;
  margin-top: 9px;
  max-width: 760px;
}

.score-header-status {
  border-left: 1px solid #e2e8f0;
  display: grid;
  gap: 3px;
  min-width: 112px;
  padding-left: 18px;
}

.score-header-status span {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
}

.score-header-status strong {
  color: #0f766e;
  font-size: 14px;
}

.scores-page > .panel {
  border-color: #e2e8f0;
  box-shadow: 0 12px 32px rgba(15, 23, 42, .045);
}

.scores-page .panel-head h2 {
  color: #0f172a;
  margin: 0;
}

.scores-page .panel-head .hint {
  line-height: 1.55;
  margin-top: 6px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.score-query-form.card-form.compact {
  grid-template-areas:
    "term session grade class"
    "subject exam keyword action";
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 10px 12px;
}

.score-query-form > * {
  min-width: 0;
}

.score-query-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.score-query-field > span {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.score-query-field--term { grid-area: term; }
.score-query-field--session { grid-area: session; }
.score-query-field--grade { grid-area: grade; }
.score-query-field--class { grid-area: class; }
.score-query-field--subject { grid-area: subject; }
.score-query-field--exam { grid-area: exam; }

.score-query-keyword {
  grid-area: keyword;
}

.score-query-form .student-search {
  min-width: 0;
}

.score-query-form input,
.score-query-form select {
  min-height: 42px;
}

.score-query-submit {
  grid-area: action;
  justify-self: end;
  width: 112px;
}

.score-form-grid {
  grid-template-columns: minmax(200px, 1.25fr) minmax(180px, 1fr) minmax(120px, 0.65fr);
  align-items: start;
}

.score-field-value input {
  max-width: 150px;
}

.score-field-value small {
  color: #64748b;
  white-space: nowrap;
}

.batch-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.batch-panel > .panel-head {
  flex: 1;
  align-items: center;
  margin-bottom: 0;
}

.batch-panel h2,
.batch-panel p {
  margin: 0;
}

.achievement-row {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 11px 14px;
}

.achievement-row__content { flex: 1; min-width: 0; }
.achievement-row__summary { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
.achievement-type { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; color: #1e40af; font-size: 11px; font-weight: 700; padding: 2px 8px; white-space: nowrap; }
.achievement-text { color: #0f172a; font-size: 14px; overflow-wrap: anywhere; }
.achievement-row__actions { display: flex; flex-shrink: 0; gap: 6px; }
.achievement-form-fields { display: grid; gap: 14px; }
.achievement-field { display: grid; gap: 6px; }
.achievement-field label { color: #334155; font-size: 13px; font-weight: 600; }
.achievement-actions { margin-top: 16px; }
.visually-hidden-file {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

.batch-context {
  color: #0f766e !important;
  font-weight: 700;
}

.batch-panel p {
  margin-top: 5px;
  color: #64748b;
  font-size: 13px;
}

.batch-actions,
.pagination-buttons,
.error-list-head,
.import-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pagination-jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  white-space: nowrap;
  font-size: 13px;
}

.pagination-jump input {
  width: 64px;
  padding: 6px 8px;
  border-radius: 8px;
}

.import-modal {
  width: min(860px, 100%);
}

.import-content {
  display: grid;
  gap: 16px;
}

.import-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.import-steps span {
  padding: 9px 12px;
  border-radius: 10px;
  color: #64748b;
  background: #f1f5f9;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.import-steps span.active {
  color: #065f46;
  background: #d1fae5;
}

.import-context-grid {
  display: grid;
  grid-template-areas:
    "term session grade class"
    "subject subject exam exam";
  grid-template-columns: minmax(180px, 1.3fr) minmax(105px, 0.75fr) minmax(140px, 1fr) minmax(220px, 1.5fr);
  gap: 12px;
}

.import-field-term { grid-area: term; }
.import-field-session { grid-area: session; }
.import-field-grade { grid-area: grade; }
.import-field-class { grid-area: class; }
.import-field-subject { grid-area: subject; }
.import-field-exam { grid-area: exam; }

.import-context-grid label {
  display: grid;
  gap: 6px;
}

.import-context-grid label > span,
.import-file-label {
  margin: 0;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.import-context-grid small,
.field-error {
  color: #b91c1c;
}

.ai-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  background: #f8fafc;
}

.ai-toggle input {
  width: auto;
  margin-top: 3px;
}

.ai-toggle strong,
.ai-toggle small {
  display: block;
}

.ai-toggle small,
.import-file-empty,
.import-loading,
.import-more-errors {
  color: #64748b;
  font-size: 12px;
}

.import-file-name {
  min-width: 0;
  color: #334155;
  word-break: break-all;
}

.error-list-head {
  justify-content: space-between;
  margin-top: 12px;
}

.error-list-head p {
  margin: 0;
  font-weight: 700;
}

.score-input {
  min-width: 80px;
  width: 100%;
}

.score-range {
  white-space: nowrap;
  color: #64748b;
  font-size: 12px;
}

/* Status badges */
.badge.info { background: #dbeafe; color: #1e40af; }
.badge.warning { background: #fef3c7; color: #92400e; }

/* Score colors */
.score-red { color: #dc2626; font-weight: 700; }
.score-green { color: #16a34a; font-weight: 700; }

/* Error */
.modal-error {
  color: #b91c1c;
  font-weight: 800;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .academic-page-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .score-header-status {
    grid-column: 1;
    grid-row: 2;
  }

  .academic-page-header > .button {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .score-query-form.card-form.compact {
    grid-template-areas:
      "term session"
      "grade class"
      "subject exam"
      "keyword action";
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .import-context-grid {
    grid-template-areas:
      "term term"
      "session grade"
      "class class"
      "subject exam";
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .academic-page-header {
    align-items: start;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .score-header-status,
  .academic-page-header > .button {
    grid-column: 1;
    grid-row: auto;
  }

  .score-header-status {
    border-left: 0;
    border-top: 1px solid #e2e8f0;
    padding: 12px 0 0;
  }

  .academic-page-header > .button {
    min-height: 44px;
    width: 100%;
  }

  .filters { grid-template-columns: 1fr; }
  .batch-panel { align-items: stretch; flex-direction: column; }
  .batch-actions { justify-content: stretch; }
  .batch-actions .button { flex: 1; }
  .score-query-form.card-form.compact {
    grid-template-areas:
      "term"
      "session"
      "grade"
      "class"
      "subject"
      "exam"
      "keyword"
      "action";
    grid-template-columns: minmax(0, 1fr);
  }
  .score-query-submit {
    justify-self: stretch;
    min-height: 44px;
    width: 100%;
  }
  .score-query-field input,
  .score-query-field select { font-size: 16px; min-height: 44px; }
  .score-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .score-field-value input {
    max-width: none;
  }
  .import-context-grid {
    grid-template-areas:
      "term"
      "session"
      "grade"
      "class"
      "subject"
      "exam";
    grid-template-columns: minmax(0, 1fr);
  }
  .import-steps { grid-template-columns: 1fr; }
  .pagination-buttons { flex-wrap: wrap; }
  .achievement-row { align-items: stretch; flex-direction: column; }
  .achievement-row__actions .button { flex: 1; min-height: 40px; }
}

/* Import error banner */
.import-error-banner {
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

/* Import result card */
.import-result-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}
.import-result-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 10px;
}
.import-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
}
.import-result-grid > div {
  text-align: center;
  padding: 8px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.import-result-grid .metric-label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}
.import-result-grid strong {
  font-size: 18px;
}
.import-error-item {
  font-size: 12px;
  color: #dc2626;
  padding: 4px 0;
  border-bottom: 1px solid #fee2e2;
}

@media (prefers-reduced-motion: reduce) {
  .scores-page *,
  .scores-page *::before,
  .scores-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
</style>
