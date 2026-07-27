<template>
  <section class="scores-page page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Teaching</p>
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
      <button class="button" type="button" :disabled="loading" @click="loadPage">刷新</button>
    </header>

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
        <form class="card-form compact" @submit.prevent="searchTeacherEntries">
          <select v-model="teacherQuery.academicTermId" @change="searchTeacherEntries">
            <option value="">学期</option>
            <option v-for="term in terms" :key="term.id" :value="String(term.id)">{{ term.termName || term.name }}</option>
          </select>
          <select v-model="teacherQuery.classId" @change="searchTeacherEntries">
            <option value="">全部班级</option>
            <option v-for="klass in classes" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option>
          </select>
          <select v-model="teacherQuery.subjectId" @change="searchTeacherEntries">
            <option value="">全部科目</option>
            <option v-for="subject in (teacherMode ? teacherSubjects : subjects)" :key="subject.id" :value="String(subject.id)">{{ subject.subjectName || subject.name }}</option>
          </select>
          <select v-model="teacherQuery.examTypeId" @change="searchTeacherEntries">
            <option value="">考试类型</option>
            <option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option>
          </select>
          <input v-model.trim="teacherKeyword" type="search" placeholder="输入学生姓名或学号自动查询" @input="onTeacherKeywordInput" />
        </form>
      </section>

      <!-- Score Entries Table -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>我的成绩录入</h2>
            <p class="hint">未录入的成绩会显示为"待录入"，点击"录入"即可维护成绩和老师评价。支持通过 Excel 模版批量导入导出。</p>
          </div>
          <div class="action-group">
            <button class="button" type="button" @click="exportTeacherTemplate">导出模版</button>
            <button class="button primary" type="button" @click="showTeacherImportDialog">导入成绩</button>
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
            <button v-for="num in teacherPageNumbers" :key="num" class="button sm" :class="{ primary: num === teacherPage.current }" type="button" @click="goTeacherPage(num)">{{ num }}</button>
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
          <div class="action-group">
            <button class="button" type="button" @click="exportHeadTeacherTemplate">导出评语模版</button>
            <button class="button" type="button" @click="exportHeadTeacherGradeTemplate">导出成绩模版</button>
            <button class="button primary" type="button" @click="showHeadTeacherImportDialog">导入</button>
            <button class="button ghost" type="button" @click="resetHeadTeacherQuery">重置</button>
          </div>
        </div>
        <form class="card-form compact" @submit.prevent="searchHeadTeacherScores">
          <select v-model="headTeacherQuery.academicTermId" @change="onHeadTeacherTermChange">
            <option value="">学期</option>
            <option v-for="term in terms" :key="term.id" :value="String(term.id)">{{ term.termName || term.name }}</option>
          </select>
          <select v-model="headTeacherQuery.classId" @change="onHeadTeacherClassChange">
            <option value="">班级</option>
            <option v-for="klass in classes" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option>
          </select>
          <select v-model="headTeacherGradeSubjectId">
            <option value="">成绩科目（导出成绩模版用）</option>
            <option v-for="subject in subjects" :key="subject.id" :value="String(subject.id)">{{ subject.subjectName || subject.name }}</option>
          </select>
          <select v-model="headTeacherQuery.examTypeId" @change="searchHeadTeacherScores">
            <option value="">考试类型</option>
            <option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option>
          </select>
          <div class="student-search">
            <input
              v-model.trim="studentKeyword"
              type="search"
              placeholder="输入学生姓名模糊搜索，按回车选择第一个"
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
          </div>
        </form>
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
              <button class="button" type="button" :disabled="downloadingTranscript" @click="downloadHeadTeacherTranscript">
                {{ downloadingTranscript ? '生成并下载中...' : '成绩单下载' }}
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
              <strong>{{ headTeacherTotalScore.toFixed(2) }}</strong>
              <span class="metric-foot">全部科目合计</span>
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
            <div
              v-for="item in achievements"
              :key="item.id"
              style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px"
            >
              <div style="flex:1; min-width:0">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
                  <span v-if="item.honorTypeName" style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; background:#dbeafe; color:#1e40af; border-radius:6px; font-size:11px; font-weight:700; white-space:nowrap">{{ item.honorTypeName }}</span>
                  <span style="font-size:14px; color:#0f172a; word-break:break-all">{{ item.achievementText || '-' }}</span>
                </div>
              </div>
              <div v-if="auth.canManageScores" style="display:flex; gap:6px; flex-shrink:0">
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
              <label>
                <span>科目</span>
                <select v-model="scoreForm.subjectId" :disabled="scoreForm.isEdit">
                  <option value="">请选择科目</option>
                  <option v-for="cs in classSubjectOptions" :key="cs.subjectId || cs.id" :value="String(cs.subjectId || cs.id)">
                    {{ cs.subjectName || cs.name }}（{{ cs.minScore ?? 0 }}-{{ cs.maxScore ?? 100 }}分）
                  </option>
                </select>
              </label>
              <label>
                <span>考试类型</span>
                <select v-model="scoreForm.examTypeId">
                  <option value="">请选择考试类型（可选）</option>
                  <option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option>
                </select>
              </label>
              <label>
                <span>成绩</span>
                <input v-model.number="scoreForm.score" type="number" :min="scoreForm.minScore" :max="scoreForm.maxScore" step="0.01" />
                <small>有效范围：{{ scoreForm.minScore }} - {{ scoreForm.maxScore }}</small>
              </label>
              <label class="full">
                <span>课程表现</span>
                <div class="textarea-with-polish">
                  <textarea v-model="scoreForm.performanceComment" rows="3" placeholder="描述这个科目的课堂表现、作业完成情况等"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'performanceComment'" @click="doPolish('performanceComment', scoreForm.performanceComment, scoreForm, 'performanceComment')" :title="polishingField === 'performanceComment' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'performanceComment' ? '⏳' : '🤖' }}</button>
                </div>
              </label>
              <label class="full">
                <span>做得好的地方</span>
                <div class="textarea-with-polish">
                  <textarea v-model="scoreForm.strengths" rows="3" placeholder="写下这个科目表现好的地方"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'strengths'" @click="doPolish('strengths', scoreForm.strengths, scoreForm, 'strengths')" :title="polishingField === 'strengths' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'strengths' ? '⏳' : '🤖' }}</button>
                </div>
              </label>
              <label class="full">
                <span>需要改进的点</span>
                <div class="textarea-with-polish">
                  <textarea v-model="scoreForm.improvementPoints" rows="3" placeholder="写下这个科目需要改进的地方"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'improvementPoints'" @click="doPolish('improvementPoints', scoreForm.improvementPoints, scoreForm, 'improvementPoints')" :title="polishingField === 'improvementPoints' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'improvementPoints' ? '⏳' : '🤖' }}</button>
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
                  <button class="polish-btn" type="button" :disabled="polishingField === 'overallComment'" @click="doPolish('overallComment', overallCommentForm.overallComment, overallCommentForm, 'overallComment')" :title="polishingField === 'overallComment' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'overallComment' ? '⏳' : '🤖' }}</button>
                </div>
              </label>
              <label class="full">
                <span>做得好的地方</span>
                <div class="textarea-with-polish">
                  <textarea v-model="overallCommentForm.strengths" rows="3" placeholder="班主任对学生整体表现中的优点"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'overallStrengths'" @click="doPolish('overallStrengths', overallCommentForm.strengths, overallCommentForm, 'strengths')" :title="polishingField === 'overallStrengths' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'overallStrengths' ? '⏳' : '🤖' }}</button>
                </div>
              </label>
              <label class="full">
                <span>需要改进的点</span>
                <div class="textarea-with-polish">
                  <textarea v-model="overallCommentForm.improvementPoints" rows="3" placeholder="班主任对学生整体表现中的改进建议"></textarea>
                  <button class="polish-btn" type="button" :disabled="polishingField === 'overallImprovementPoints'" @click="doPolish('overallImprovementPoints', overallCommentForm.improvementPoints, overallCommentForm, 'improvementPoints')" :title="polishingField === 'overallImprovementPoints' ? 'AI 润色中...' : 'AI 润色评语'">{{ polishingField === 'overallImprovementPoints' ? '⏳' : '🤖' }}</button>
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
            <div style="display:grid; gap:14px">
              <div>
                <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px">荣誉类型</label>
                <select v-model="achievementForm.honorTypeId">
                  <option value="">请选择荣誉类型（可选）</option>
                  <option v-for="type in honorTypes" :key="type.id" :value="String(type.id)">{{ type.honorTypeName || type.name }}</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px">荣誉详细内容</label>
                <textarea v-model="achievementForm.achievementText" rows="3" placeholder="描述该荣誉的具体内容..."></textarea>
              </div>
            </div>
            <div class="modal-actions" style="margin-top:16px">
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
        <section class="modal-card" role="dialog" aria-modal="true" style="max-width: 480px;">
          <div class="modal-head">
            <h2>{{ importDialogTitle }}</h2>
            <button class="button ghost sm" type="button" @click="closeImportDialog">关闭</button>
          </div>
          <div style="display:grid; gap:16px;">
            <!-- AI polish toggle -->
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding: 10px 14px; background:#f8fafc; border-radius:10px;">
              <input type="checkbox" v-model="importEnableAiPolish" style="width:18px; height:18px;" />
              <div>
                <strong style="font-size:14px; color:#0f172a;">AI 润色评语</strong>
                <small style="display:block; color:#64748b; margin-top:2px;">启用后自动优化评语和荣誉内容的文字表达</small>
              </div>
            </label>

            <!-- Error display -->
            <div v-if="importError" class="import-error-banner">
              <span>⚠️ {{ importError }}</span>
            </div>

            <!-- File selection -->
            <div>
              <p style="font-size:13px; color:#475569; margin-bottom:8px; font-weight:600;">选择 Excel 文件（.xlsx）</p>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="button" type="button" @click="importFileInput?.click()">选择文件</button>
                <span v-if="importSelectedFile" style="font-size:13px; color:#334155; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ importSelectedFile.name }}</span>
                <span v-else style="font-size:13px; color:#94a3b8;">未选择文件</span>
                <input
                  ref="importFileInput"
                  type="file"
                  accept=".xlsx"
                  @change="onImportFileSelected"
                  style="display:none"
                />
              </div>
            </div>

            <!-- Loading -->
            <p v-if="importLoading" style="text-align:center; color:#64748b; margin:0;">⏳ 正在导入，请稍候...</p>

            <!-- Result -->
            <div v-if="importResult" class="import-result-card">
              <p class="import-result-title">导入完成</p>
              <div class="import-result-grid">
                <div><span class="metric-label">总行数</span><strong>{{ importResult.total }}</strong></div>
                <div><span class="metric-label">成功</span><strong style="color:#16a34a;">{{ importResult.success }}</strong></div>
                <div><span class="metric-label">跳过</span><strong style="color:#64748b;">{{ importResult.skipped }}</strong></div>
                <div><span class="metric-label">失败</span><strong style="color:#dc2626;">{{ importResult.failed }}</strong></div>
                <div v-if="importResult.aiPolished > 0"><span class="metric-label">AI 润色</span><strong style="color:#0f766e;">{{ importResult.aiPolished }} 条</strong></div>
              </div>
              <div v-if="importResult.errors && importResult.errors.length" style="margin-top:12px;">
                <p style="font-size:12px; font-weight:700; color:#dc2626; margin-bottom:6px;">失败详情：</p>
                <div v-for="(err, idx) in importResult.errors.slice(0, 20)" :key="idx" class="import-error-item">
                  第{{ err.row }}行 {{ err.studentName }}：{{ err.reason }}
                </div>
                <p v-if="importResult.errors.length > 20" style="font-size:11px; color:#64748b; margin-top:4px;">... 还有 {{ importResult.errors.length - 20 }} 条错误未显示</p>
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button class="button ghost" type="button" @click="closeImportDialog">取消</button>
              <button
                class="button primary"
                type="button"
                :disabled="!importSelectedFile || importLoading"
                @click="doImport"
              >{{ importLoading ? '导入中...' : '开始导入' }}</button>
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
import { useRoute } from 'vue-router'
import DownloadProgress from '../components/DownloadProgress.vue'
import * as schoolApi from '../api/school'
import { useAuthStore } from '../stores/auth'
import { useErrorStore } from '../stores/error'

type AnyRow = Record<string, any>

const auth = useAuthStore()
const errorStore = useErrorStore()
const route = useRoute()

// ---- Workspace Tab ----
const workspaceTab = ref<'teacher' | 'headTeacher'>('headTeacher')

const teacherMode = computed(() => {
  if (auth.isSuperAdmin) return false
  if (auth.isDualRoleTeacher) return workspaceTab.value === 'teacher'
  return auth.isTeacher && !auth.isHeadTeacher
})

function switchToTeacher() {
  workspaceTab.value = 'teacher'
  // Clear head-teacher-specific state
  headTeacherQuery.studentId = ''
  studentKeyword.value = ''
  headTeacherScoreRows.value = []
  overallComments.value = []
  achievements.value = []
  loadPage()
}

function switchToHeadTeacher() {
  workspaceTab.value = 'headTeacher'
  // Clear teacher-specific state
  teacherKeyword.value = ''
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
const teacherQuery = reactive({ academicTermId: '', classId: '', subjectId: '', examTypeId: '' })
const teacherKeyword = ref('')
const teacherPage = reactive({ current: 1, size: 20 })
let teacherKeywordTimer: ReturnType<typeof setTimeout> | null = null

const teacherPageNumbers = computed(() => {
  const count = Math.max(1, Math.ceil(teacherTotal.value / teacherPage.size))
  return Array.from({ length: Math.min(count, 7) }, (_, i) => i + 1)
})

function teacherRowKey(row: AnyRow) {
  return `${row.classSubjectId || ''}_${row.studentId || ''}_${row.examTypeId || ''}_${row.id || Math.random()}`
}

function onTeacherKeywordInput() {
  if (teacherKeywordTimer) clearTimeout(teacherKeywordTimer)
  teacherKeywordTimer = setTimeout(() => searchTeacherEntries(), 400)
}

async function searchTeacherEntries() {
  globalError.value = ''
  teacherPage.current = 1
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
  teacherScoreRows.value = (rows(res) as AnyRow[]).map((row: AnyRow) => ({
    ...row,
    hasScore: row.score != null && row.score !== '' && Number(row.score) > 0
  }))
  teacherTotal.value = totalOf(res)

  // 提取任课老师所教的科目（去重）
  const seen = new Map<string, AnyRow>()
  for (const r of teacherScoreRows.value) {
    if (r.subjectId && !seen.has(String(r.subjectId))) {
      seen.set(String(r.subjectId), { id: r.subjectId, subjectName: r.subjectName || r.subject, minScore: r.minScore, maxScore: r.maxScore })
    }
  }
  teacherSubjects.value = Array.from(seen.values())
}

function goTeacherPage(num: number) {
  teacherPage.current = num
  loadTeacherEntries()
}

function resetTeacherQuery() {
  teacherQuery.academicTermId = ''
  teacherQuery.classId = ''
  teacherQuery.subjectId = ''
  teacherQuery.examTypeId = ''
  teacherKeyword.value = ''
  teacherPage.current = 1
  teacherScoreRows.value = []
  teacherTotal.value = 0
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
const headTeacherQuery = reactive({ academicTermId: '', classId: '', examTypeId: '', studentId: '' })
const headTeacherGradeSubjectId = ref('')
const studentKeyword = ref('')
const studentSuggestions = ref<AnyRow[]>([])
const allStudents = ref<AnyRow[]>([])

const selectedStudent = computed(() => {
  if (!headTeacherQuery.studentId) return null
  return allStudents.value.find((s) => String(s.id) === String(headTeacherQuery.studentId)) || null
})

const currentTermName = computed(() => {
  const term = terms.value.find((t) => String(t.id) === String(headTeacherQuery.academicTermId))
  return term?.termName || term?.name || '-'
})

const headTeacherTotalScore = computed(() => {
  return headTeacherScoreRows.value.reduce((sum, row) => sum + (Number(row.score) || 0), 0)
})

function headTeacherRowKey(row: AnyRow) {
  return `${row.subjectId || ''}_${row.examTypeId || ''}_${row.id || Math.random()}`
}

async function searchStudents() {
  // 用户重新输入时清除已选学生，恢复搜索下拉
  headTeacherQuery.studentId = ''
  if (!studentKeyword.value) {
    studentSuggestions.value = []
    return
  }
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
  studentKeyword.value = ''
  await searchHeadTeacherScores()
}

async function onHeadTeacherClassChange() {
  headTeacherQuery.studentId = ''
  studentKeyword.value = ''
  if (headTeacherQuery.classId) {
    try {
      const res = await call('listStudents', { classId: Number(headTeacherQuery.classId), page: 1, size: 500 })
      allStudents.value = rows(res)
    } catch {
      allStudents.value = []
    }
  } else {
    allStudents.value = []
  }
  await searchHeadTeacherScores()
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

function resetHeadTeacherQuery() {
  headTeacherQuery.academicTermId = ''
  headTeacherQuery.classId = ''
  headTeacherQuery.examTypeId = ''
  headTeacherQuery.studentId = ''
  studentKeyword.value = ''
  studentSuggestions.value = []
  headTeacherScoreRows.value = []
  overallComments.value = []
  achievements.value = []
  headTeacherTranscript.value = null
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
    scoreForm.examTypeId = String(row.examTypeId || '')
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
    classSubjectOptions.value = teacherSubjects.value.map(s => ({
      subjectId: s.id, subjectName: s.subjectName, minScore: s.minScore, maxScore: s.maxScore
    }))
  } else if (teacherMode.value && subjects.value.length > 0) {
    // 任课老师无任教课程数据时回退到全部科目列表
    classSubjectOptions.value = subjects.value.map(s => ({
      subjectId: s.id, subjectName: s.subjectName || s.name, minScore: s.minScore ?? 0, maxScore: s.maxScore ?? 100
    }))
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
    evaluatorUserId: auth.user?.id ? Number(auth.user.id) : undefined,
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
const importScene = ref<'teacher' | 'headTeacher'>('teacher')

function showTeacherImportDialog() {
  if (!teacherQuery.academicTermId) { errorStore.show('请先选择学期'); return }
  if (!teacherQuery.classId) { errorStore.show('请先选择班级'); return }
  if (!teacherQuery.subjectId) { errorStore.show('请先选择科目'); return }
  importScene.value = 'teacher'
  importDialogTitle.value = '导入单科成绩'
  importEnableAiPolish.value = false
  importResult.value = null
  importError.value = ''
  importSelectedFile.value = null
  importLoading.value = false
  importDialogVisible.value = true
}

function showHeadTeacherImportDialog() {
  if (!headTeacherQuery.academicTermId) { errorStore.show('请先选择学期'); return }
  if (!headTeacherQuery.classId) { errorStore.show('请先选择班级'); return }
  importScene.value = 'headTeacher'
  importDialogTitle.value = '导入综合评价与荣誉'
  importEnableAiPolish.value = false
  importResult.value = null
  importError.value = ''
  importSelectedFile.value = null
  importLoading.value = false
  importDialogVisible.value = true
}

function closeImportDialog() {
  importDialogVisible.value = false
  importResult.value = null
  importError.value = ''
  importSelectedFile.value = null
  importLoading.value = false
}

function onImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    importSelectedFile.value = file
    importError.value = ''
    importResult.value = null
  }
}

async function doImport() {
  const file = importSelectedFile.value
  if (!file) { importError.value = '请先选择 Excel 文件'; return }
  importLoading.value = true
  importError.value = ''
  importResult.value = null
  try {
    let result: any
    if (importScene.value === 'teacher') {
      result = await schoolApi.importCourseResults(file, importEnableAiPolish.value)
    } else {
      result = await schoolApi.importHeadTeacherData(file, importEnableAiPolish.value)
    }
    importResult.value = result?.data ?? result ?? {}
    importSelectedFile.value = null
    if (importFileInput.value) importFileInput.value.value = ''

    // 导入成功提醒
    const r = importResult.value
    const msg = `导入完成：共 ${r.total || 0} 条，成功 ${r.success || 0} 条`
        + (r.skipped ? `，跳过 ${r.skipped} 条` : '')
        + (r.failed ? `，失败 ${r.failed} 条` : '')
    alert(msg)

    // 刷新列表：仅在有选中学生时才刷新个人数据
    if (teacherMode.value) await loadTeacherEntries()
    else if (headTeacherQuery.studentId) { await loadOverallComments(); await loadAchievements() }
  } catch (e: any) {
    importError.value = e?.message || '导入失败，请检查文件格式'
  } finally {
    importLoading.value = false
  }
}

async function exportTeacherTemplate() {
  if (!teacherQuery.academicTermId) {
    errorStore.show('请先选择学期')
    return
  }
  if (!teacherQuery.classId) {
    errorStore.show('请先选择班级')
    return
  }
  if (!teacherQuery.subjectId) {
    errorStore.show('请先选择科目')
    return
  }
  try {
    const res: any = await schoolApi.exportCourseResultTemplate({
      academicTermId: Number(teacherQuery.academicTermId),
      classId: Number(teacherQuery.classId),
      subjectId: Number(teacherQuery.subjectId),
      examTypeId: teacherQuery.examTypeId ? Number(teacherQuery.examTypeId) : undefined
    })
    saveBlobFile(res, `成绩模版_${getClassNameById(teacherQuery.classId)}_${getSubjectNameById(teacherQuery.subjectId)}.xlsx`)
  } catch (e: any) {
    if (e?.message) errorStore.show(e.message)
  }
}

async function exportHeadTeacherTemplate() {
  if (!headTeacherQuery.academicTermId) {
    errorStore.show('请先选择学期')
    return
  }
  if (!headTeacherQuery.classId) {
    errorStore.show('请先选择班级')
    return
  }
  try {
    const res: any = await schoolApi.exportHeadTeacherTemplate({
      academicTermId: Number(headTeacherQuery.academicTermId),
      classId: Number(headTeacherQuery.classId)
    })
    saveBlobFile(res, `综合评价与荣誉_${getClassNameById(headTeacherQuery.classId)}.xlsx`)
  } catch (e: any) {
    if (e?.message) errorStore.show(e.message)
  }
}

// 班主任导出课程成绩模版（可导出班级全部课程）
async function exportHeadTeacherGradeTemplate() {
  if (!headTeacherQuery.academicTermId) { errorStore.show('请先选择学期'); return }
  if (!headTeacherQuery.classId) { errorStore.show('请先选择班级'); return }
  if (!headTeacherGradeSubjectId.value) { errorStore.show('请选择成绩科目'); return }
  try {
    const res: any = await schoolApi.exportCourseResultTemplate({
      academicTermId: Number(headTeacherQuery.academicTermId),
      classId: Number(headTeacherQuery.classId),
      subjectId: Number(headTeacherGradeSubjectId.value),
      examTypeId: headTeacherQuery.examTypeId ? Number(headTeacherQuery.examTypeId) : undefined
    })
    saveBlobFile(res, `成绩模版_${getClassNameById(headTeacherQuery.classId)}_${getSubjectNameById(headTeacherGradeSubjectId.value)}.xlsx`)
  } catch (e: any) {
    if (e?.message) errorStore.show(e.message)
  }
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
  const s = subjects.value.find((x: AnyRow) => String(x.id) === subjectId)
  return s?.subjectName || s?.name || subjectId
}

// ---- Initialization ----
async function loadBaseData() {
  // Pass mode param for dual-role teachers so backend filters classes/subjects correctly
  const modeParam: AnyRow = { page: 1, size: 500 }
  if (auth.isDualRoleTeacher && teacherMode.value) {
    modeParam.mode = workspaceTab.value
  }
  const subjectParam: AnyRow = {}
  if (auth.isDualRoleTeacher && teacherMode.value) {
    subjectParam.mode = workspaceTab.value
  }
  const [termRes, classRes, subjectRes, examRes, honorRes] = await Promise.all([
    call('listAcademicTerms'),
    call('listClasses', modeParam),
    call('listSubjects', subjectParam),
    call('listExamTypes'),
    call('listEnabledHonorTypes').catch(() => call('listHonorTypes'))
  ])
  terms.value = rows(termRes)
  classes.value = rows(classRes)
  subjects.value = rows(subjectRes)
  examTypes.value = rows(examRes)
  honorTypes.value = rows(honorRes)
}

function initFromRoute() {
  const routeAcademicTermId = route.query.academicTermId as string
  const routeClassId = route.query.classId as string
  const routeStudentId = route.query.studentId as string

  if (routeAcademicTermId) headTeacherQuery.academicTermId = routeAcademicTermId
  if (routeClassId) headTeacherQuery.classId = routeClassId
  if (routeStudentId) {
    headTeacherQuery.studentId = routeStudentId
    // Switch to head teacher workspace when coming from student list
    workspaceTab.value = 'headTeacher'
  }
}

async function loadPage() {
  loading.value = true
  globalError.value = ''
  try {
    await loadBaseData()

    // Auto-set default term if not set
    const defaultTerm = terms.value.find((t: AnyRow) => Number(t.status) === 1) || terms.value[0]
    // 如果从学生页面进入（已带 studentId），不自动设置学期，展示全部成绩
    if (defaultTerm && !headTeacherQuery.academicTermId && !headTeacherQuery.studentId) {
      headTeacherQuery.academicTermId = String(defaultTerm.id)
    }
    if (defaultTerm && !teacherQuery.academicTermId) {
      teacherQuery.academicTermId = String(defaultTerm.id)
    }

    // Auto-set default class for head teacher mode if not set
    if (!teacherMode.value && !headTeacherQuery.classId && classes.value.length > 0) {
      headTeacherQuery.classId = String(classes.value[0].id)
    }

    if (teacherMode.value) {
      // Teacher mode: load entries for assigned courses
      await loadTeacherEntries()
    } else {
      // Head teacher mode
      // 保存从 route 传入的 studentId，避免 onHeadTeacherClassChange 清空
      const routeStudentId = headTeacherQuery.studentId

      if (headTeacherQuery.classId) {
        await onHeadTeacherClassChange()
      }

      // 恢复从 route 传入的 studentId
      if (routeStudentId) {
        headTeacherQuery.studentId = routeStudentId
      }

      // If studentId is set but classId wasn't, auto-detect class from student
      if (!headTeacherQuery.classId && headTeacherQuery.studentId) {
        const student = allStudents.value.find((s) => String(s.id) === String(headTeacherQuery.studentId))
        if (student?.classId) {
          headTeacherQuery.classId = String(student.classId)
          await onHeadTeacherClassChange()
        }
      }

      // If student not found in class students, clear selection
      if (headTeacherQuery.studentId && allStudents.value.length > 0 &&
          !allStudents.value.some((s) => String(s.id) === String(headTeacherQuery.studentId))) {
        headTeacherQuery.studentId = ''
        studentKeyword.value = ''
      }

      // Set student keyword from selected student name
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
  () => [route.query.classId, route.query.studentId, route.query.academicTermId],
  () => {
    initFromRoute()
    loadPage()
  }
)
</script>

<style scoped>
.scores-page {
  display: grid;
  gap: 20px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
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

@media (max-width: 760px) {
  .filters { grid-template-columns: 1fr; }
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
</style>
