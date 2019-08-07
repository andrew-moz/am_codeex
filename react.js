

class Api::InfoDialogController < ActionController::Base

  before_action :authenticate_user!

  include ActionView::Helpers::TagHelper
  include ActionView::Helpers::UrlHelper
  include ActionView::Helpers::TextHelper
  include SurveysHelper
  include SurveysContext


  def show

    survey = current_survey

    return render status: :not_found unless current_user.owns_survey?(survey)
    survey.update(update_set: false)

    topic = survey.full_topic
    time_frame = survey.time_frame
    time_frame_duration = last_word(survey.time_frame)
    leader_name = survey.leader_name

    answers = []
    survey.survey_answers.each do |answer|
      response = answer.attributes
      response[:team_member_name] = member_name(answer.team_member, answer)
      response[:team_member_email] = answer.team_member[:email]
      answers << response
    end

    render json: {
      survey: survey,
      answers: answers,
      topic: topic,
      time_frame: time_frame,
      time_frame_duration: time_frame_duration,
      leader_name: leader_name
    }

  end

end


// ===================


import React from 'react';
import {BrowserRouter as Router, Route, NavLink, Redirect} from "react-router-dom";

import OneTimeSurveyList from './surveyLists/oneTimeSurveyList';
import DraftSurveyList from './surveyLists/draftSurveyList';

  class OneTimeSurveyTab extends React.Component {

    render() {
      return (
        <Router>
          <div>
            <ul className="survey-filters">
              <li>Filter view:</li>
              <li>
                <NavLink activeClassName="selected" to={'/maps/one_time_surveys/active'} id="active" data-hasqtip="234"
                      title="All Xmetryx feedback that is currently waiting for responses. These cannot be edited or deleted."
                       aria-describedby="qtip-234">
                  active
                </NavLink>
              </li>
              <li>
                <NavLink activeClassName="selected" to={`/maps/one_time_surveys/completed`} id="completed" data-hasqtip="236"
                      title="All responses have been received, or the survey close date has passed. These cannot be edited or deleted.">
                  completed
                </NavLink>
              </li>
              <li>
                <NavLink activeClassName="selected" to={`/maps/one_time_surveys/scheduled`} id="scheduled" data-hasqtip="238"
                      title="These surveys have not yet started. You can still edit or delete them.">
                  scheduled
                </NavLink>
              </li>
              <li>
                <NavLink activeClassName='selected' id="draft" to="/maps/one_time_surveys/draft" data-hasqtip="230"
                      title="These are surveys that were never fully finalized and sent. Highlight any and click Finalize Xmetryx to complete the setup."
                      aria-describedby="qtip-230">
                  draft
                </NavLink>
              </li>
              <li>
                <NavLink activeClassName="selected" to={`/maps/one_time_surveys/all`} id="all" data-hasqtip="240"
                      title="All.">
                  all
                </NavLink>
              </li>
            </ul>

            <Route exact path='/maps/one_time_surveys' render={ () => <Redirect to='/maps/one_time_surveys/active' /> } />
            <Route path="/maps/one_time_surveys/active" render={ () => <OneTimeSurveyList status='active' /> } />
            <Route path="/maps/one_time_surveys/completed" render={ () => <OneTimeSurveyList status='completed' /> } />
            <Route path="/maps/one_time_surveys/scheduled" render={ () => <OneTimeSurveyList status='scheduled' /> } />
            <Route path="/maps/one_time_surveys/draft" component={DraftSurveyList}/>
            <Route path="/maps/one_time_surveys/all" render={ () => <OneTimeSurveyList status='all' /> } />
          </div>
        </Router>
      )
    };
  };

  export default OneTimeSurveyTab;


// ===================


import React from 'react';
import Loader from './loader';
const $ = require('jquery');

require('es6-promise').polyfill();
require('isomorphic-fetch');

class InfoDialog extends React.Component {

  constructor() {
    super();
    this.state = {
      survey: {},
      answers: [],
      topic: '',
      time_frame: '',
      time_frame_duration: '',
      leader_name: ''
    }
  };

  componentDidMount() {
    Loader.showLoader();

    fetch(this.url(), { credentials: 'include' })
    .then(response => response.json())
    .then(responseData => {

      this.setState({
        survey: responseData.survey,
        answers: responseData.answers,
        topic: responseData.topic,
        time_frame: responseData.time_frame,
        time_frame_duration: responseData.time_frame_duration,
        leader_name: responseData.leader_name
      });

      $('#modal-2').click();
      this.showQtipZindex();
      Loader.hideLoader()
    })
    .catch(error => {
      console.log('Error fetching and parsing data', error);
    });
  };

  url = () => {
    return `/api/info_dialog/${this.props.surveyId}`;
  };

  showQtipZindex() {
    $.fn.qtip.zindex = 9999999999;
  };

  render() {

    const answersList = this.state.answers.map(answer =>
      <li title={answer.team_member_email} key={answer.id} dangerouslySetInnerHTML={{__html: answer.team_member_name }} />
    );

    return (
      <div>
        <p> The following shows the status of each invitation that was sent for this Xmetryx employee survey: Sent (in process), Delivered, or Bounced. To send the survey invitation again, click "Resend". If the status shows "Bounced" be sure to update the Team Member's email address before you resend the invitation.</p>
        <div className="checkbox-bloc">
          <div className="checkbox-group-label">Sent To:</div>
          <div className="row clearfix">
            <div>
              <ul>{answersList}</ul>
            </div>
          </div>
        </div>
        <p></p>
        <div className="modal-anon">
          <h4 className="modal-question-title">{this.state.survey.name}</h4>

          <span className="questions-header red">Introduction</span>
          <p>Think about your {this.state.topic} during {this.state.time_frame_duration} {this.state.time_frame}. Now consider every aspect of the support you received from {this.state.leader_name} to achieve your {this.state.topic}...</p>

          <span className="questions-header red">Experience Question</span>
          <p>How do you feel about the experience you had working with {this.state.leader_name} during {this.state.time_frame_duration} {this.state.time_frame} to achieve your {this.state.topic}?</p>

          <span className="questions-header red">Expectation Question</span>
          <p>What were your expectations that working with {this.state.leader_name} would help you achieve your {this.state.topic}?</p>
        </div>
      </div>
    )
  };
};

export default InfoDialog;


// ===================


import React from 'react';
import Table from '../tables/table';
import Loader from '../loader';
import BaseSurveyList from './baseSurveyList';
import DeleteSurveyListener from '../../listeners/deleteSurveyListener';

require('es6-promise').polyfill();
require('isomorphic-fetch');

const $ = require('jquery');
$.DataTable = require('datatables');

class OneTimeSurveyList extends BaseSurveyList {

  deleteOneTimeSurvey(){
    DeleteSurveyListener.run();
  };

  componentDidMount(){
    this.$el = $(this.el);
    this.type = 'one_time';
    this.fetchData();
  }

  fetchData(groups = [], order = 'desc'){
    const self = this;
    Loader.showLoader();

    let url = this.url(order);
    if(groups.length > 0){
      url += '&groups=' +  encodeURIComponent(JSON.stringify(groups))
    }

    fetch(url, { credentials: 'include' })
      .then(response => response.json())
      .then(responseData => {
        const table = new Table(self.$el, self.type, self.props.status);
        table.render(responseData['surveys']);
        table.attachSurveyRowListeners();
        Loader.hideLoader();
        this.deleteOneTimeSurvey();
      }).catch(error => {
        console.log('Error fetching and parsing data', error);
      });
  }

  url(order = 'desc'){
    return `/api/one_time_surveys/index?status=${this.props.status}&order=${order}`;
  }
};

export default OneTimeSurveyList;



